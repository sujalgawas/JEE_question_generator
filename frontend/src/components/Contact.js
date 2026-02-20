import React, { useState } from 'react';
import {
  Mail, Phone, MapPin, Send, MessageSquare, Clock,
  CheckCircle, AlertCircle, Github, Twitter, Linkedin,
  Instagram, User, MessageCircle, ChevronDown,
} from 'lucide-react';

/* ── input ── */
const InputField = ({ icon: Icon, label, type = 'text', value, onChange, placeholder, required }) => (
  <div className="space-y-1.5">
    <label className="text-sm font-medium text-surface-300 flex items-center gap-1.5">
      <Icon className="w-3.5 h-3.5 text-accent-400" />
      {label}
      {required && <span className="text-danger-400">*</span>}
    </label>
    <input
      type={type} value={value} onChange={onChange} placeholder={placeholder} required={required}
      className="w-full px-4 py-3 bg-surface-700/50 border border-surface-600 rounded-xl text-white placeholder-surface-500 focus:outline-none focus:border-accent-500/50 focus:ring-2 focus:ring-accent-500/20 transition-all text-sm"
    />
  </div>
);

/* ── textarea ── */
const TextareaField = ({ icon: Icon, label, value, onChange, placeholder, required, rows = 5 }) => (
  <div className="space-y-1.5">
    <label className="text-sm font-medium text-surface-300 flex items-center gap-1.5">
      <Icon className="w-3.5 h-3.5 text-accent-400" />
      {label}
      {required && <span className="text-danger-400">*</span>}
    </label>
    <textarea
      value={value} onChange={onChange} placeholder={placeholder} required={required} rows={rows}
      className="w-full px-4 py-3 bg-surface-700/50 border border-surface-600 rounded-xl text-white placeholder-surface-500 focus:outline-none focus:border-accent-500/50 focus:ring-2 focus:ring-accent-500/20 transition-all text-sm resize-none"
    />
  </div>
);

/* ── FAQ ── */
const FAQItem = ({ question, answer }) => {
  const [open, setOpen] = useState(false);
  return (
    <div className="border border-surface-700 rounded-xl overflow-hidden">
      <button onClick={() => setOpen(!open)} className="w-full flex items-center justify-between px-5 py-4 text-left hover:bg-surface-700/30 transition-colors">
        <span className="text-sm font-medium text-white pr-4">{question}</span>
        <ChevronDown className={`w-4 h-4 text-surface-500 shrink-0 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      <div className={`overflow-hidden transition-all ${open ? 'max-h-96 opacity-100' : 'max-h-0 opacity-0'}`}>
        <div className="px-5 pb-4 text-sm text-surface-400 leading-relaxed">{answer}</div>
      </div>
    </div>
  );
};

/* ═══════  Contact Component  ═══════ */
function Contact() {
  const [formData, setFormData] = useState({ name: '', email: '', subject: '', message: '' });
  const [formStatus, setFormStatus] = useState({ type: '', message: '' });
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleInputChange = (field, value) => {
    setFormData((p) => ({ ...p, [field]: value }));
    if (formStatus.type === 'error') setFormStatus({ type: '', message: '' });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);
    setFormStatus({ type: '', message: '' });
    try {
      await new Promise((r) => setTimeout(r, 2000));
      setFormStatus({ type: 'success', message: "Thank you! We'll get back to you soon." });
      setFormData({ name: '', email: '', subject: '', message: '' });
    } catch {
      setFormStatus({ type: 'error', message: 'Something went wrong. Please try again.' });
    } finally {
      setIsSubmitting(false);
    }
  };

  const faqs = [
    { question: 'How quickly can I expect a response?', answer: 'We typically respond within 24–48 hours on business days. Mark urgent matters in your subject line for faster attention.' },
    {
      question: 'Can I schedule a demo?', answer: 'Yes! Mention your preferred dates in the message and we\'ll arrange a time.'
    },
    { question: 'Do you offer technical support?', answer: 'We provide comprehensive technical support for all users, with priority support for premium accounts.' },
    { question: 'How can I report a bug?', answer: 'Use the contact form or reach out through our GitHub repository. Include steps to reproduce the issue.' },
  ];

  return (
    <div className="min-h-screen bg-surface-900">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-8">
        {/* header */}
        <div className="mb-8">
          <h1 className="text-2xl sm:text-3xl font-bold text-white mb-1">Contact Us</h1>
          <p className="text-surface-400 text-sm">Have questions or feedback? We'd love to hear from you.</p>
        </div>

        {/* info cards */}
        <div className="grid sm:grid-cols-3 gap-4 mb-8">
          {[
            { icon: Mail, title: 'Email', info: 'support@jeegenius.com', sub: 'Response within 24h' },
            { icon: Phone, title: 'Phone', info: '+91 98765 43210', sub: 'Mon–Fri, 9am–6pm IST' },
            { icon: MapPin, title: 'Location', info: 'Mumbai, Maharashtra', sub: 'India' },
          ].map((c) => (
            <div key={c.title} className="bg-surface-800 rounded-xl border border-surface-700 p-5">
              <div className="p-2.5 rounded-lg bg-accent-500/10 w-fit mb-3">
                <c.icon className="w-5 h-5 text-accent-400" />
              </div>
              <h3 className="text-white font-semibold mb-1">{c.title}</h3>
              <p className="text-surface-300 text-sm">{c.info}</p>
              <p className="text-surface-500 text-xs mt-0.5">{c.sub}</p>
            </div>
          ))}
        </div>

        {/* form + sidebar */}
        <div className="grid lg:grid-cols-3 gap-6 mb-8">
          {/* form */}
          <div className="lg:col-span-2 bg-surface-800 rounded-xl border border-surface-700 p-6">
            <h2 className="text-lg font-semibold text-white mb-5 flex items-center gap-2">
              <Send className="w-4 h-4 text-accent-400" /> Send a Message
            </h2>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid sm:grid-cols-2 gap-4">
                <InputField icon={User} label="Name" value={formData.name} onChange={(e) => handleInputChange('name', e.target.value)} placeholder="Your name" required />
                <InputField icon={Mail} label="Email" type="email" value={formData.email} onChange={(e) => handleInputChange('email', e.target.value)} placeholder="you@example.com" required />
              </div>
              <InputField icon={MessageCircle} label="Subject" value={formData.subject} onChange={(e) => handleInputChange('subject', e.target.value)} placeholder="How can we help?" required />
              <TextareaField icon={MessageSquare} label="Message" value={formData.message} onChange={(e) => handleInputChange('message', e.target.value)} placeholder="Tell us more…" required rows={5} />

              {formStatus.message && (
                <div className={`flex items-center gap-2 p-3 rounded-lg text-sm ${formStatus.type === 'success'
                  ? 'bg-success-500/10 border border-success-500/20 text-success-400'
                  : 'bg-danger-500/10 border border-danger-500/20 text-danger-400'
                  }`}>
                  {formStatus.type === 'success' ? <CheckCircle className="w-4 h-4 shrink-0" /> : <AlertCircle className="w-4 h-4 shrink-0" />}
                  {formStatus.message}
                </div>
              )}

              <button
                type="submit" disabled={isSubmitting}
                className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-accent-600 hover:bg-accent-500 text-white font-semibold transition-colors disabled:opacity-50"
              >
                {isSubmitting ? (
                  <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                ) : (
                  <><Send className="w-4 h-4" /> Send Message</>
                )}
              </button>
            </form>
          </div>

          {/* sidebar */}
          <div className="space-y-4">
            {/* hours */}
            <div className="bg-surface-800 rounded-xl border border-surface-700 p-5">
              <h3 className="text-sm font-semibold text-white mb-3 flex items-center gap-1.5">
                <Clock className="w-4 h-4 text-accent-400" /> Office Hours
              </h3>
              <div className="space-y-2 text-sm">
                {[
                  ['Mon – Fri', '9:00 AM – 6:00 PM'],
                  ['Saturday', '10:00 AM – 4:00 PM'],
                  ['Sunday', 'Closed'],
                ].map(([day, time]) => (
                  <div key={day} className="flex justify-between">
                    <span className="text-surface-400">{day}</span>
                    <span className={`font-medium ${time === 'Closed' ? 'text-danger-400' : 'text-white'}`}>{time}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* socials */}
            <div className="bg-surface-800 rounded-xl border border-surface-700 p-5">
              <h3 className="text-sm font-semibold text-white mb-3">Connect With Us</h3>
              <div className="flex items-center gap-2">
                {[
                  { icon: Twitter, href: 'https://twitter.com' },
                  { icon: Linkedin, href: 'https://linkedin.com' },
                  { icon: Github, href: 'https://github.com' },
                  { icon: Instagram, href: 'https://instagram.com' },
                ].map((s, i) => (
                  <a key={i} href={s.href} target="_blank" rel="noopener noreferrer"
                    className="p-2.5 rounded-lg bg-surface-700 hover:bg-surface-600 text-surface-400 hover:text-white transition-colors"
                  >
                    <s.icon className="w-4 h-4" />
                  </a>
                ))}
              </div>
            </div>

            {/* tip */}
            <div className="rounded-xl bg-warning-500/5 border border-warning-500/15 p-4">
              <p className="text-xs text-surface-400 leading-relaxed">
                <span className="text-warning-400 font-medium">Tip:</span> For faster support, include your account email and steps to reproduce any issues.
              </p>
            </div>
          </div>
        </div>

        {/* FAQ */}
        <div className="bg-surface-800 rounded-xl border border-surface-700 p-6">
          <h2 className="text-lg font-semibold text-white mb-1">Frequently Asked Questions</h2>
          <p className="text-surface-500 text-sm mb-5">Quick answers to common questions</p>
          <div className="max-w-3xl space-y-3">
            {faqs.map((faq, i) => <FAQItem key={i} question={faq.question} answer={faq.answer} />)}
          </div>
        </div>
      </div>
    </div>
  );
}

export default Contact;
