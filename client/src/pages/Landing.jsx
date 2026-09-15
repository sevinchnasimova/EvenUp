import { useRef } from 'react';
import { motion, useScroll, useTransform } from 'framer-motion';

function Landing({ onGetStarted }) {
  const heroRef = useRef(null);
  const { scrollYProgress } = useScroll({
    target: heroRef,
    offset: ['start start', 'end start'],
  });
  const heroOpacity = useTransform(scrollYProgress, [0, 0.8], [1, 0]);

  return (
    <div className="landing-page">
      <section ref={heroRef} className="landing-hero">
        <motion.div className="landing-hero-inner" style={{ opacity: heroOpacity }}>
          <motion.div
            initial={{ opacity: 0, y: 50 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 1, delay: 0.3, ease: [0.25, 0.46, 0.45, 0.94] }}
          >
            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.8, delay: 0.6 }}
              className="landing-eyebrow"
            >
              Simple. Fair. Stress-free.
            </motion.p>
            <h1 className="landing-heading">
              Split Bills,
              <br />
              <em>Keep Friends</em>
            </h1>
            <p className="landing-lede">
              Track shared expenses, settle up effortlessly, and keep everyone on the
              same page — without the awkward reminders.
            </p>
            <div className="landing-cta">
              <button type="button" className="primary" onClick={onGetStarted}>
                Get Started
              </button>
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 1.5 }}
            className="landing-scroll-hint"
          >
            <span>Scroll</span>
            <motion.svg
              width="16"
              height="16"
              viewBox="0 0 20 20"
              fill="none"
              animate={{ y: [0, 8, 0] }}
              transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
              style={{ color: 'var(--ink-faint)' }}
            >
              <path
                d="M10 3v13m0 0-5-5m5 5 5-5"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </motion.svg>
          </motion.div>
        </motion.div>
      </section>

      <section className="landing-intro">
        <p>
          From road trips to roommate bills, EvenUp helps you divide costs fairly,
          record who paid what, and settle up with the fewest payments possible. No
          spreadsheets, no confusion, no hard feelings.
        </p>
      </section>
    </div>
  );
}

export default Landing;
