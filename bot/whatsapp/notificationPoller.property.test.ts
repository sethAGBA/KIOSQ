// Feature: whatsapp-commandes-bot, Property 9: filtrage des transitions de statut notifiables

import { describe, it, expect, vi, beforeEach } from 'vitest';
import fc from 'fast-check';
import { isTransitionNotifiable, statutCommandeValues, type StatutCommande } from './notificationPoller';

/**
 * Validates: Requirements 8.3
 *
 * Property 9: Filtrage des transitions de statut notifiables
 *
 * For every pair (ancien, nouveau) drawn from StatutCommande, the function
 * isTransitionNotifiable() must return true if and only if the pair belongs
 * to the authorised set:
 *   { brouillon→confirme, confirme→en_preparation,
 *     en_preparation→expedie, expedie→livre }
 */

// The exact set of eligible transitions (source of truth for tests)
const ELIGIBLE_TRANSITIONS = new Set<string>([
  'brouillon→confirme',
  'confirme→en_preparation',
  'en_preparation→expedie',
  'expedie→livre',
]);

// ─── Property-based tests ─────────────────────────────────────────────────────

describe('notificationPoller — Property 9: transitions notifiables (Req 8.3)', () => {
  it(
    'Property 9 — isTransitionNotifiable est biconditionnelle exacte sur toutes les paires (100 itérations)',
    () => {
      fc.assert(
        fc.property(
          fc.constantFrom(...statutCommandeValues),
          fc.constantFrom(...statutCommandeValues),
          (ancien: StatutCommande, nouveau: StatutCommande) => {
            const eligible = ELIGIBLE_TRANSITIONS.has(`${ancien}→${nouveau}`);
            const result = isTransitionNotifiable(ancien, nouveau);
            return result === eligible;
          },
        ),
        { numRuns: 100 },
      );
    },
  );

  // ─── Unit tests for each eligible transition ──────────────────────────────

  describe('unit tests — transitions éligibles retournent true', () => {
    it('brouillon → confirme (éligible)', () => {
      expect(isTransitionNotifiable('brouillon', 'confirme')).toBe(true);
    });

    it('confirme → en_preparation (éligible)', () => {
      expect(isTransitionNotifiable('confirme', 'en_preparation')).toBe(true);
    });

    it('en_preparation → expedie (éligible)', () => {
      expect(isTransitionNotifiable('en_preparation', 'expedie')).toBe(true);
    });

    it('expedie → livre (éligible)', () => {
      expect(isTransitionNotifiable('expedie', 'livre')).toBe(true);
    });
  });

  describe('unit tests — transitions non éligibles retournent false', () => {
    it('confirme → annule (non éligible)', () => {
      expect(isTransitionNotifiable('confirme', 'annule')).toBe(false);
    });

    it('brouillon → annule (non éligible)', () => {
      expect(isTransitionNotifiable('brouillon', 'annule')).toBe(false);
    });

    it('livre → annule (non éligible — état terminal)', () => {
      expect(isTransitionNotifiable('livre', 'annule')).toBe(false);
    });

    it('brouillon → en_preparation (saut d\'étape, non éligible)', () => {
      expect(isTransitionNotifiable('brouillon', 'en_preparation')).toBe(false);
    });

    it('brouillon → brouillon (identique, non éligible)', () => {
      expect(isTransitionNotifiable('brouillon', 'brouillon')).toBe(false);
    });

    it('expedie → confirme (régression de statut, non éligible)', () => {
      expect(isTransitionNotifiable('expedie', 'confirme')).toBe(false);
    });
  });

  describe('unit tests — exhaustivité : exactement 4 transitions éligibles dans l\'enum complet', () => {
    it('exactement 4 paires éligibles parmi toutes les paires possibles', () => {
      const eligibleCount = statutCommandeValues.flatMap((ancien) =>
        statutCommandeValues.map((nouveau) => isTransitionNotifiable(ancien, nouveau)),
      ).filter(Boolean).length;

      expect(eligibleCount).toBe(4);
    });

    it('les paires éligibles correspondent exactement aux 4 transitions du design', () => {
      const foundTransitions = statutCommandeValues
        .flatMap((ancien) =>
          statutCommandeValues
            .filter((nouveau) => isTransitionNotifiable(ancien, nouveau))
            .map((nouveau) => `${ancien}→${nouveau}`),
        )
        .sort();

      expect(foundTransitions).toEqual([
        'brouillon→confirme',
        'confirme→en_preparation',
        'en_preparation→expedie',
        'expedie→livre',
      ]);
    });
  });
});

// ─── Unit tests for polling behaviour ─────────────────────────────────────────

describe('notificationPoller — tests unitaires comportement du polling', () => {
  /**
   * Because pollCommandeStatuts uses module-level Maps (knownStatuts,
   * trackedCommandes), we test isTransitionNotifiable directly to validate
   * the notification gate logic without fighting shared state.
   *
   * These tests verify:
   *   - An eligible transition would trigger a notification (gate is open)
   *   - A non-eligible transition would NOT trigger a notification (gate is closed)
   */

  it('transition éligible brouillon→confirme : la porte de notification est ouverte', () => {
    // Simulates: after a poll cycle detects statut changed from 'brouillon' to 'confirme',
    // isTransitionNotifiable returns true → sendNotificationWithRetry would be called
    const ancienStatut = 'brouillon';
    const nouveauStatut = 'confirme';

    expect(isTransitionNotifiable(ancienStatut, nouveauStatut)).toBe(true);
  });

  it('transition non éligible confirme→annule : la porte de notification est fermée', () => {
    // Simulates: after a poll cycle detects statut changed from 'confirme' to 'annule',
    // isTransitionNotifiable returns false → no notification is sent
    const ancienStatut = 'confirme';
    const nouveauStatut = 'annule';

    expect(isTransitionNotifiable(ancienStatut, nouveauStatut)).toBe(false);
  });

  it('toutes les transitions depuis annule sont non notifiables', () => {
    // 'annule' is a terminal state — no transition from it should be notifiable
    for (const nouveau of statutCommandeValues) {
      expect(isTransitionNotifiable('annule', nouveau)).toBe(false);
    }
  });

  it('toutes les transitions depuis livre sont non notifiables', () => {
    // 'livre' is a terminal state — no transition from it should be notifiable
    for (const nouveau of statutCommandeValues) {
      expect(isTransitionNotifiable('livre', nouveau)).toBe(false);
    }
  });
});
