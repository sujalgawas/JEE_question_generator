// src/components/Contact.js
import React, { useState } from 'react';
import { 
  Mail, 
  Phone, 
  MapPin, 
  Send, 
  MessageSquare,
  Clock,
  CheckCircle,
  AlertCircle,
  Github,
  Twitter,
  Linkedin,
  Instagram,
  Globe,
  Sparkles,
  User,
  MessageCircle
} from 'lucide-react';

// Input Field Component
const InputField = ({ icon: Icon, label, type = "text", value, onChange, placeholder, required = false, error = "" }) => (
  <div className="space-y-2">
    <label className="text-sm font-semibold text-gray-300 flex items-center gap-2">
      <Icon className="w-4 h-4 text-blue-400" />
      {label}
      {required && <span className="text-red-400">*</span>}
    </label>
    <input
      type={type}
      value={value}
      onChange={onChange}
      placeholder={placeholder}
      required={required}
      className="w-full px-4 py-3 bg-gray-800/60 backdrop-blur-xl border border-gray-700/50 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:border-blue-500/50 focus:ring-2 focus:ring-blue-500/20 transition-all duration-300"
    />
    {error && (
      <p className="text-red-400 text-xs flex items-center gap-1">
        <AlertCircle className="w-3 h-3" />
        {error}
      </p>
    )}
  </div>
);

// Textarea Field Component
const TextareaField = ({ icon: Icon, label, value, onChange, placeholder, required = false, rows = 5, error = "" }) => (
  <div className="space-y-2">
    <label className="text-sm font-semibold text-gray-300 flex items-center gap-2">
      <Icon className="w-4 h-4 text-blue-400" />
      {label}
      {required && <span className="text-red-400">*</span>}
    </label>
    <textarea
      value={value}
      onChange={onChange}
      placeholder={placeholder}
      required={required}
      rows={rows}
      className="w-full px-4 py-3 bg-gray-800/60 backdrop-blur-xl border border-gray-700/50 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:border-blue-500/50 focus:ring-2 focus:ring-blue-500/20 transition-all duration-300 resize-none"
    />
    {error && (
      <p className="text-red-400 text-xs flex items-center gap-1">
        <AlertCircle className="w-3 h-3" />
        {error}
      </p>
    )}
  </div>
);

// Contact Info Card Component
const ContactInfoCard = ({ icon: Icon, title, info, subInfo, color, delay }) => (
  <div 
    className="group relative animate-in slide-in-from-bottom"
    style={{ animationDelay: `${delay}ms`, animationDuration: '500ms' }}
  >
    <div className="absolute inset-0 bg-gradient-to-r from-blue-500/10 to-purple-500/10 rounded-2xl blur-xl opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
    <div className="relative bg-gradient-to-br from-gray-800/60 to-gray-900/60 backdrop-blur-xl p-6 rounded-2xl border border-gray-700/50 hover:border-blue-500/50 transition-all duration-300 hover:-translate-y-1">
      <div className={`p-4 bg-gradient-to-br ${color} rounded-xl w-fit mb-4 group-hover:scale-110 transition-transform duration-300`}>
        <Icon className="w-6 h-6 text-white" />
      </div>
      <h3 className="text-lg font-bold text-white mb-2">{title}</h3>
      <p className="text-gray-300 font-medium">{info}</p>
      {subInfo && <p className="text-gray-500 text-sm mt-1">{subInfo}</p>}
    </div>
  </div>
);

// Social Link Component
const SocialLink = ({ icon: Icon, label, href, color }) => (
  <a
    href={href}
    target="_blank"
    rel="noopener noreferrer"
    className="group relative flex items-center gap-3 px-4 py-3 bg-gray-800/60 backdrop-blur-xl border border-gray-700/50 rounded-xl hover:border-blue-500/50 transition-all duration-300 hover:-translate-y-1"
  >
    <div className={`p-2 bg-gradient-to-br ${color} rounded-lg group-hover:scale-110 transition-transform duration-300`}>
      <Icon className="w-5 h-5 text-white" />
    </div>
    <span className="text-gray-300 font-semibold group-hover:text-white transition-colors duration-300">
      {label}
    </span>
  </a>
);

// FAQ Item Component
const FAQItem = ({ question, answer }) => {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="bg-gray-800/40 backdrop-blur-xl border border-gray-700/50 rounded-xl overflow-hidden hover:border-blue-500/30 transition-all duration-300">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between p-5 text-left hover:bg-gray-800/60 transition-colors duration-300"
      >
        <span className="text-white font-semibold pr-4">{question}</span>
        <div className={`transform transition-transform duration-300 ${isOpen ? 'rotate-180' : ''}`}>
          <svg className="w-5 h-5 text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </div>
      </button>
      <div 
        className={`overflow-hidden transition-all duration-300 ${
          isOpen ? 'max-h-96 opacity-100' : 'max-h-0 opacity-0'
        }`}
      >
        <div className="px-5 pb-5 text-gray-400 leading-relaxed">
          {answer}
        </div>
      </div>
    </div>
  );
};

// Main Contact Component
function Contact() {
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    subject: '',
    message: ''
  });
  const [formStatus, setFormStatus] = useState({ type: '', message: '' });
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleInputChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    // Clear error when user starts typing
    if (formStatus.type === 'error') {
      setFormStatus({ type: '', message: '' });
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);
    setFormStatus({ type: '', message: '' });

    // Simulate API call
    try {
      // Replace this with your actual API endpoint
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      setFormStatus({ 
        type: 'success', 
        message: 'Thank you for your message! We\'ll get back to you soon.' 
      });
      setFormData({ name: '', email: '', subject: '', message: '' });
    } catch (error) {
      setFormStatus({ 
        type: 'error', 
        message: 'Oops! Something went wrong. Please try again.' 
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const faqs = [
    {
      question: "How quickly can I expect a response?",
      answer: "We typically respond to all inquiries within 24-48 hours during business days. For urgent matters, please indicate this in your subject line."
    },
    {
      question: "Can I schedule a demo or consultation?",
      answer: "Absolutely! Please mention your preferred dates and times in your message, and we'll arrange a convenient time for a demo or consultation."
    },
    {
      question: "Do you offer technical support?",
      answer: "Yes, we provide comprehensive technical support for all our users. Premium users get priority support with faster response times."
    },
    {
      question: "How can I report a bug or suggest a feature?",
      answer: "We welcome all feedback! Please use the contact form and select 'Bug Report' or 'Feature Request' as your subject. You can also reach out through our GitHub repository."
    }
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-slate-900 to-gray-900 text-white p-6 relative overflow-hidden">
      {/* Background Effects */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-blue-500/10 rounded-full blur-3xl animate-pulse"></div>
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-purple-500/10 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '1s' }}></div>
      </div>

      <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.02)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.02)_1px,transparent_1px)] bg-[size:50px_50px] [mask-image:radial-gradient(ellipse_at_center,black_20%,transparent_80%)]"></div>

      <div className="max-w-7xl mx-auto relative z-10">
        {/* Header */}
        <div className="text-center mb-12 animate-in fade-in slide-in-from-top" style={{ animationDuration: '700ms' }}>
          <div className="inline-flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-blue-500/10 to-purple-500/10 border border-blue-500/30 rounded-full mb-6 backdrop-blur-sm">
            <MessageSquare className="w-4 h-4 text-blue-400" />
            <span className="text-sm text-blue-300 font-medium">Get In Touch</span>
          </div>
          <h1 className="text-5xl md:text-6xl font-black mb-4">
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-purple-500">
              Contact Us
            </span>
          </h1>
          <p className="text-gray-400 text-lg max-w-2xl mx-auto">
            Have questions or feedback? We'd love to hear from you. Send us a message and we'll respond as soon as possible.
          </p>
        </div>

        {/* Contact Info Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12">
          <ContactInfoCard 
            icon={Mail}
            title="Email Us"
            info="support@jeegenius.com"
            subInfo="We'll respond within 24 hours"
            color="from-blue-500/20 to-blue-600/20"
            delay={0}
          />
          <ContactInfoCard 
            icon={Phone}
            title="Call Us"
            info="+91 98765 43210"
            subInfo="Mon-Fri, 9am-6pm IST"
            color="from-purple-500/20 to-purple-600/20"
            delay={100}
          />
          <ContactInfoCard 
            icon={MapPin}
            title="Visit Us"
            info="Mumbai, Maharashtra"
            subInfo="India"
            color="from-pink-500/20 to-pink-600/20"
            delay={200}
          />
        </div>

        {/* Main Content Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mb-12">
          {/* Contact Form - 2 columns */}
          <div className="lg:col-span-2 bg-gradient-to-br from-gray-800/60 to-gray-900/60 backdrop-blur-xl p-8 rounded-3xl border border-gray-700/50 animate-in slide-in-from-left" style={{ animationDuration: '700ms' }}>
            <div className="flex items-center gap-3 mb-6">
              <div className="p-3 bg-gradient-to-br from-blue-500/20 to-purple-500/20 rounded-xl">
                <Send className="w-6 h-6 text-blue-400" />
              </div>
              <h2 className="text-2xl font-bold text-white">Send us a Message</h2>
            </div>

            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <InputField
                  icon={User}
                  label="Your Name"
                  type="text"
                  value={formData.name}
                  onChange={(e) => handleInputChange('name', e.target.value)}
                  placeholder="John Doe"
                  required
                />
                <InputField
                  icon={Mail}
                  label="Email Address"
                  type="email"
                  value={formData.email}
                  onChange={(e) => handleInputChange('email', e.target.value)}
                  placeholder="john@example.com"
                  required
                />
              </div>

              <InputField
                icon={MessageCircle}
                label="Subject"
                type="text"
                value={formData.subject}
                onChange={(e) => handleInputChange('subject', e.target.value)}
                placeholder="How can we help you?"
                required
              />

              <TextareaField
                icon={MessageSquare}
                label="Message"
                value={formData.message}
                onChange={(e) => handleInputChange('message', e.target.value)}
                placeholder="Tell us more about your inquiry..."
                required
                rows={6}
              />

              {formStatus.message && (
                <div className={`flex items-center gap-3 p-4 rounded-xl border ${
                  formStatus.type === 'success' 
                    ? 'bg-green-500/10 border-green-500/30 text-green-400' 
                    : 'bg-red-500/10 border-red-500/30 text-red-400'
                }`}>
                  {formStatus.type === 'success' ? (
                    <CheckCircle className="w-5 h-5 flex-shrink-0" />
                  ) : (
                    <AlertCircle className="w-5 h-5 flex-shrink-0" />
                  )}
                  <p className="text-sm font-medium">{formStatus.message}</p>
                </div>
              )}

              <button
                type="submit"
                disabled={isSubmitting}
                className="group relative w-full flex items-center justify-center gap-2 px-6 py-4 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-500 hover:to-purple-500 text-white font-bold rounded-xl transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed hover:scale-[1.02] shadow-lg shadow-blue-500/30"
              >
                <div className="absolute inset-0 bg-gradient-to-r from-blue-500/0 to-purple-500/0 group-hover:from-blue-500/20 group-hover:to-purple-500/20 rounded-xl blur-xl transition-all duration-300"></div>
                {isSubmitting ? (
                  <>
                    <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                    <span className="relative z-10">Sending...</span>
                  </>
                ) : (
                  <>
                    <Send className="w-5 h-5 relative z-10 group-hover:translate-x-1 transition-transform duration-300" />
                    <span className="relative z-10">Send Message</span>
                  </>
                )}
              </button>
            </form>
          </div>

          {/* Sidebar - 1 column */}
          <div className="space-y-6 animate-in slide-in-from-right" style={{ animationDuration: '700ms' }}>
            {/* Office Hours */}
            <div className="bg-gradient-to-br from-gray-800/60 to-gray-900/60 backdrop-blur-xl p-6 rounded-2xl border border-gray-700/50">
              <div className="flex items-center gap-3 mb-4">
                <div className="p-2 bg-gradient-to-br from-green-500/20 to-green-600/20 rounded-lg">
                  <Clock className="w-5 h-5 text-green-400" />
                </div>
                <h3 className="text-lg font-bold text-white">Office Hours</h3>
              </div>
              <div className="space-y-3 text-sm">
                <div className="flex justify-between items-center">
                  <span className="text-gray-400">Monday - Friday</span>
                  <span className="text-white font-semibold">9:00 AM - 6:00 PM</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-gray-400">Saturday</span>
                  <span className="text-white font-semibold">10:00 AM - 4:00 PM</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-gray-400">Sunday</span>
                  <span className="text-red-400 font-semibold">Closed</span>
                </div>
              </div>
            </div>

            {/* Social Links */}
            <div className="bg-gradient-to-br from-gray-800/60 to-gray-900/60 backdrop-blur-xl p-6 rounded-2xl border border-gray-700/50">
              <div className="flex items-center gap-3 mb-4">
                <div className="p-2 bg-gradient-to-br from-blue-500/20 to-purple-500/20 rounded-lg">
                  <Sparkles className="w-5 h-5 text-blue-400" />
                </div>
                <h3 className="text-lg font-bold text-white">Connect With Us</h3>
              </div>
              <div className="space-y-3">
                <SocialLink 
                  icon={Twitter}
                  label="Twitter"
                  href="https://twitter.com"
                  color="from-blue-400/20 to-blue-500/20"
                />
                <SocialLink 
                  icon={Linkedin}
                  label="LinkedIn"
                  href="https://linkedin.com"
                  color="from-blue-600/20 to-blue-700/20"
                />
                <SocialLink 
                  icon={Github}
                  label="GitHub"
                  href="https://github.com"
                  color="from-gray-600/20 to-gray-700/20"
                />
                <SocialLink 
                  icon={Instagram}
                  label="Instagram"
                  href="https://instagram.com"
                  color="from-pink-500/20 to-purple-500/20"
                />
              </div>
            </div>

            {/* Quick Tip */}
            <div className="bg-gradient-to-br from-yellow-500/10 to-orange-500/10 backdrop-blur-xl p-6 rounded-2xl border border-yellow-500/30">
              <div className="flex items-start gap-3">
                <Sparkles className="w-5 h-5 text-yellow-400 flex-shrink-0 mt-1" />
                <div>
                  <h4 className="text-white font-bold mb-2">Pro Tip</h4>
                  <p className="text-gray-300 text-sm">
                    For faster support, include your account email and a detailed description of your issue.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* FAQ Section */}
        <div className="bg-gradient-to-br from-gray-800/60 to-gray-900/60 backdrop-blur-xl p-8 rounded-3xl border border-gray-700/50">
          <div className="text-center mb-8">
            <h2 className="text-3xl font-black text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-purple-500 mb-3">
              Frequently Asked Questions
            </h2>
            <p className="text-gray-400">Quick answers to common questions</p>
          </div>
          <div className="max-w-3xl mx-auto space-y-4">
            {faqs.map((faq, index) => (
              <FAQItem key={index} question={faq.question} answer={faq.answer} />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

export default Contact;
