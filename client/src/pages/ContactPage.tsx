import { useState } from 'react';
import type { CSSProperties } from 'react';

const revealDelay = (index: number, base = 80): CSSProperties =>
  ({
    '--reveal-delay': `${index * base}ms`,
  } as CSSProperties);

const ContactPage = () => {
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    message: ''
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    // Handle form submission
    console.log('Form submitted:', formData);
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    });
  };

  const teamMembers = [
    {
      name: 'Dr. Sarah Mitchell',
      role: 'Chief Medical Officer'
    },
    {
      name: 'James Chen',
      role: 'Lead AI Architect'
    },
    {
      name: 'Maria Rodriguez',
      role: 'Blockchain Engineer'
    },
    {
      name: 'David Park',
      role: 'Product Manager'
    },
    {
      name: 'Emily Watson',
      role: 'UX Research Lead'
    }
  ];

  return (
    <div className="min-h-screen py-12">
      <div className="mx-auto max-w-7xl px-6">
        {/* Info Banner */}
        <div className="mb-12 rounded-2xl border border-white/10 bg-white/5 p-6" data-reveal>
          <p className="text-white/70">
            The Pulse Ledger is evolving rapidly. Share your ideas, report an issue, or request early access to our clinical partner program.
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
          {/* Get in Touch Form */}
          <div data-reveal>
            <h2 className="text-3xl font-display font-semibold text-white mb-8">Get in Touch</h2>
            
            <form onSubmit={handleSubmit} className="space-y-6">
              <div>
                <label htmlFor="name" className="block text-sm font-semibold text-white/70 mb-2">
                  Name
                </label>
                <input
                  type="text"
                  id="name"
                  name="name"
                  value={formData.name}
                  onChange={handleChange}
                  placeholder="Your full name"
                  className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white placeholder:text-white/40 focus:border-white/30 focus:outline-none transition"
                  required
                />
              </div>

              <div>
                <label htmlFor="email" className="block text-sm font-semibold text-white/70 mb-2">
                  Email
                </label>
                <input
                  type="email"
                  id="email"
                  name="email"
                  value={formData.email}
                  onChange={handleChange}
                  placeholder="you@example.com"
                  className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white placeholder:text-white/40 focus:border-white/30 focus:outline-none transition"
                  required
                />
              </div>

              <div>
                <label htmlFor="message" className="block text-sm font-semibold text-white/70 mb-2">
                  Message
                </label>
                <textarea
                  id="message"
                  name="message"
                  value={formData.message}
                  onChange={handleChange}
                  placeholder="How can we help?"
                  rows={6}
                  className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white placeholder:text-white/40 focus:border-white/30 focus:outline-none transition resize-none"
                  required
                />
              </div>

              <button
                type="submit"
                className="w-full rounded-xl bg-[color:var(--agent-accent)] px-6 py-3 text-sm font-semibold text-[color:var(--agent-on-accent)] transition hover:-translate-y-0.5 shadow-lg shadow-black/30"
              >
                Send Message
              </button>
            </form>
          </div>

          {/* Team Health Care */}
          <div data-reveal>
            <h2 className="text-3xl font-display font-semibold text-white mb-8">Team Health Care</h2>
            
            <div className="space-y-4">
              {teamMembers.map((member, index) => (
                <div
                  key={index}
                  className="rounded-2xl border border-white/10 bg-[color:var(--agent-surface)] p-4"
                  data-reveal
                  style={revealDelay(index)}
                >
                  <h3 className="text-lg font-semibold text-white mb-1">
                    {member.name}
                  </h3>
                  <p className="text-white/60">{member.role}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ContactPage;
