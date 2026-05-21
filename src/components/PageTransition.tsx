import { motion } from 'framer-motion';
import type { ReactNode } from 'react';

/**
 * PageTransition — wraps a page in a fade + 4px lift.
 * 150ms ease-out, no slide-in, no spring. Used inside ClinicalLayout
 * so every routed page gets a consistent transition.
 */
export function PageTransition({ children }: { children: ReactNode }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.15, ease: 'easeOut' }}
    >
      {children}
    </motion.div>
  );
}
