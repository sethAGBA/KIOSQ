import type { ProduitDisponible } from './types.js';

/**
 * Normalise une chaîne de texte :
 * - Minuscules
 * - Suppression des accents (diacritiques)
 * - Suppression de la ponctuation et espaces superflus
 */
export function normaliserTexte(str: string): string {
  return str
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Calcule la distance de Levenshtein entre deux chaînes courtes.
 */
export function distanceLevenshtein(a: string, b: string): number {
  if (a === b) return 0;
  if (a.length === 0) return b.length;
  if (b.length === 0) return a.length;

  const matrix: number[][] = [];
  for (let i = 0; i <= b.length; i++) matrix[i] = [i];
  for (let j = 0; j <= a.length; j++) matrix[0]![j] = j;

  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      const cost = b.charAt(i - 1) === a.charAt(j - 1) ? 0 : 1;
      matrix[i]![j] = Math.min(
        matrix[i - 1]![j]! + 1,      // insertion
        matrix[i]![j - 1]! + 1,      // suppression
        matrix[i - 1]![j - 1]! + cost // substitution
      );
    }
  }

  return matrix[b.length]![a.length]!;
}

/**
 * Calcule un score de similarité (0 à 1) entre un mot clé et un mot cible.
 */
function similariteMot(motRecherche: string, motCible: string): number {
  if (motRecherche === motCible) return 1.0;
  if (motCible.startsWith(motRecherche)) return 0.9;
  if (motCible.includes(motRecherche)) return 0.8;

  // Si au moins 3 caractères, tester Levenshtein
  if (motRecherche.length >= 3 && motCible.length >= 3) {
    const dist = distanceLevenshtein(motRecherche, motCible);
    const maxLen = Math.max(motRecherche.length, motCible.length);
    const ratio = 1 - dist / maxLen;
    // Tolérer 1 faute si mot court, 2 si mot long
    if (dist <= (motRecherche.length > 5 ? 2 : 1)) {
      return Math.max(0.6, ratio);
    }
  }

  return 0;
}

/**
 * Évalue la pertinence (score 0 à 1) d'un produit par rapport à une recherche utilisateur.
 */
export function scorerProduit(recherche: string, designation: string): number {
  const queryNorm = normaliserTexte(recherche);
  const cibleNorm = normaliserTexte(designation);

  if (!queryNorm || !cibleNorm) return 0;
  if (cibleNorm === queryNorm) return 1.0;
  if (cibleNorm.includes(queryNorm)) return 0.95;

  const motsQuery = queryNorm.split(' ').filter(w => w.length > 1);
  const motsCible = cibleNorm.split(' ').filter(w => w.length > 1);

  if (motsQuery.length === 0) return 0;

  // Calcul du score moyen des mots recherchés par rapport aux meilleurs mots cibles
  let scoreTotal = 0;
  for (const q of motsQuery) {
    let meilleurScoreMot = 0;
    for (const c of motsCible) {
      const s = similariteMot(q, c);
      if (s > meilleurScoreMot) meilleurScoreMot = s;
    }
    scoreTotal += meilleurScoreMot;
  }

  return scoreTotal / motsQuery.length;
}

/**
 * Trouve le meilleur produit correspondant à une requête utilisateur parmi le catalogue disponible.
 * Retourne le produit et son score s'il dépasse le seuil (par défaut 0.6).
 */
export function trouverMeilleurProduit(
  requete: string,
  produits: ProduitDisponible[],
  seuil = 0.55,
): { produit: ProduitDisponible; score: number } | null {
  let meilleur: { produit: ProduitDisponible; score: number } | null = null;

  for (const produit of produits) {
    const score = scorerProduit(requete, produit.designation);
    if (score >= seuil && (!meilleur || score > meilleur.score)) {
      meilleur = { produit, score };
    }
  }

  return meilleur;
}

/**
 * Recherche des produits et retourne une liste triée par pertinence.
 */
export function rechercherProduits(
  requete: string,
  produits: ProduitDisponible[],
  limite = 5,
  seuil = 0.4,
): Array<{ produit: ProduitDisponible; score: number }> {
  return produits
    .map(produit => ({ produit, score: scorerProduit(requete, produit.designation) }))
    .filter(item => item.score >= seuil)
    .sort((a, b) => b.score - a.score)
    .slice(0, limite);
}
