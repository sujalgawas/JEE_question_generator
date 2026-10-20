import os
import re
from typing import Dict, List, Any, Optional
import chromadb

SECTION_MAPPING = {
    "experience": [
        "work experience", "professional experience", "employment history",
        "experience", "internships", "work history", "employment"
    ],
    "past projects": [
        "past projects", "projects", "personal projects", "academic projects",
        "key projects", "technical projects", "selected projects", "project experience"
    ],
    "skills": [
        "technical skills", "skills", "core skills", "technologies",
        "tools & technologies", "tools and technologies", "programming languages",
        "technical competencies", "competencies"
    ],
    "education": [
        "education", "educational background", "academic background",
        "academics", "qualifications", "academic qualifications"
    ],
    "summary": [
        "summary", "professional summary", "profile", "about me",
        "career objective", "objective", "executive summary"
    ],
    "certifications": [
        "certifications", "licenses & certifications", "licenses and certifications",
        "certificates", "achievements", "awards", "honors & awards"
    ]
}


def _match_section_header(line: str) -> Optional[str]:
    cleaned = line.strip().lower()
    cleaned = re.sub(r"[:\-\|\#]+$", "", cleaned).strip()
    
    if not cleaned or len(cleaned) > 50:
        return None

    for canonical, aliases in SECTION_MAPPING.items():
        for alias in aliases:
            pattern = rf"^(\#{1,4}\s*)?{re.escape(alias)}$"
            if re.match(pattern, cleaned):
                return canonical
    return None


def split_resume_into_sections(resume_text: str) -> Dict[str, str]:
    lines = resume_text.splitlines()
    sections: Dict[str, List[str]] = {}
    current_section = "summary"
    
    for line in lines:
        matched = _match_section_header(line)
        if matched:
            current_section = matched
            if current_section not in sections:
                sections[current_section] = []
            continue
        
        if current_section not in sections:
            sections[current_section] = []
        sections[current_section].append(line)

    cleaned_sections: Dict[str, str] = {}
    for section_name, section_lines in sections.items():
        text_content = "\n".join(section_lines).strip()
        if text_content:
            cleaned_sections[section_name] = text_content

    if not cleaned_sections:
        cleaned_sections["general"] = resume_text.strip()

    return cleaned_sections


def get_chroma_client(resume_dir: str):
    os.makedirs(resume_dir, exist_ok=True)
    return chromadb.PersistentClient(path=resume_dir)


def build_resume_vector_db(username: str, resume_text: str, base_dir: str = "./resume") -> Dict[str, Any]:
    user_resume_dir = os.path.join(base_dir, username)
    chroma_db_path = os.path.join(user_resume_dir, "chromadb")
    os.makedirs(user_resume_dir, exist_ok=True)

    with open(os.path.join(user_resume_dir, "resume.txt"), "w", encoding="utf-8") as f:
        f.write(resume_text)

    sections = split_resume_into_sections(resume_text)

    for sec_name, sec_text in sections.items():
        safe_name = re.sub(r"[^a-zA-Z0-9_]+", "_", sec_name.strip().lower())
        file_path = os.path.join(user_resume_dir, f"{safe_name}.txt")
        with open(file_path, "w", encoding="utf-8") as f:
            f.write(sec_text)

    client = get_chroma_client(chroma_db_path)
    collection_name = f"resume_{username.lower()}"

    try:
        client.delete_collection(name=collection_name)
    except Exception:
        pass

    collection = client.create_collection(
        name=collection_name,
        metadata={"hnsw:space": "cosine"}
    )

    documents = []
    metadatas = []
    ids = []

    for idx, (sec_name, sec_text) in enumerate(sections.items()):
        if len(sec_text) > 1500:
            paragraphs = [p.strip() for p in sec_text.split("\n\n") if p.strip()]
            for p_idx, paragraph in enumerate(paragraphs):
                documents.append(paragraph)
                metadatas.append({
                    "username": username,
                    "section": sec_name,
                    "chunk_index": p_idx
                })
                ids.append(f"{username}_{sec_name}_{idx}_{p_idx}")
        else:
            documents.append(sec_text)
            metadatas.append({
                "username": username,
                "section": sec_name,
                "chunk_index": 0
            })
            ids.append(f"{username}_{sec_name}_{idx}")

    if documents:
        collection.add(
            documents=documents,
            metadatas=metadatas,
            ids=ids
        )

    return {
        "status": "success",
        "username": username,
        "sections": list(sections.keys()),
        "chunks_indexed": len(documents)
    }


def query_resume_section(username: str, section: str, base_dir: str = "./resume", n_results: int = 2) -> str:
    user_resume_dir = os.path.join(base_dir, username)
    chroma_db_path = os.path.join(user_resume_dir, "chromadb")
    canonical_query = section.strip().lower()

    for canonical, aliases in SECTION_MAPPING.items():
        if canonical_query == canonical or canonical_query in aliases:
            canonical_query = canonical
            break

    try:
        if os.path.exists(chroma_db_path):
            client = get_chroma_client(chroma_db_path)
            collection_name = f"resume_{username.lower()}"
            collection = client.get_collection(name=collection_name)

            exact_match = collection.get(where={"section": canonical_query})
            if exact_match and exact_match.get("documents"):
                return "\n\n".join(exact_match["documents"])

            query_res = collection.query(query_texts=[section], n_results=n_results)
            if query_res and query_res.get("documents") and query_res["documents"][0]:
                return "\n\n".join(query_res["documents"][0])
    except Exception as e:
        print(f"ChromaDB lookup warning for {username} - {section}: {e}")

    safe_name = re.sub(r"[^a-zA-Z0-9_]+", "_", canonical_query)
    section_file = os.path.join(user_resume_dir, f"{safe_name}.txt")
    if os.path.exists(section_file):
        with open(section_file, "r", encoding="utf-8") as f:
            return f.read().strip()

    resume_file = os.path.join(user_resume_dir, "resume.txt")
    if os.path.exists(resume_file):
        with open(resume_file, "r", encoding="utf-8") as f:
            return f.read().strip()

    return f"No resume context found for section '{section}' of user '{username}'."
