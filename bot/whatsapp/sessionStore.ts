import type { Session } from './types.js';

const SESSION_TTL_MS = 30 * 60 * 1000;   // 30 minutes
const SWEEP_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes

export class SessionStore {
  private readonly sessions = new Map<string, Session>();

  constructor() {
    // Automatically remove expired sessions every 5 minutes.
    // .unref() prevents the interval from keeping the process alive when it
    // is otherwise idle (Node.js-specific; cast required without @types/node).
    const timer = setInterval(() => this.sweep(), SWEEP_INTERVAL_MS);
    if (typeof (timer as unknown as { unref?: () => void }).unref === 'function') {
      (timer as unknown as { unref: () => void }).unref();
    }
  }

  /** Return the session for the given phone number, or undefined if absent. */
  get(phone: string): Session | undefined {
    return this.sessions.get(phone);
  }

  /** Store (or overwrite) the session for the given phone number. */
  set(phone: string, session: Session): void {
    this.sessions.set(phone, session);
  }

  /**
   * Update `lastActivity` to the current timestamp, keeping the rest of the
   * session intact. Does nothing if the phone has no active session.
   */
  touch(phone: string): void {
    const session = this.sessions.get(phone);
    if (session) {
      session.lastActivity = Date.now();
    }
  }

  /** Remove the session for the given phone number. */
  delete(phone: string): void {
    this.sessions.delete(phone);
  }

  /**
   * Return true when the session has been inactive for longer than
   * SESSION_TTL_MS (30 minutes).
   */
  isExpired(session: Session): boolean {
    return Date.now() - session.lastActivity > SESSION_TTL_MS;
  }

  /**
   * Remove all expired sessions from the store.
   * Called automatically every 5 minutes; can also be called manually.
   */
  sweep(): void {
    for (const [phone, session] of this.sessions) {
      if (this.isExpired(session)) {
        this.sessions.delete(phone);
      }
    }
  }
}
