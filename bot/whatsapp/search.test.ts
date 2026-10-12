import { describe, it, expect } from 'vitest';
import { normaliserTexte, distanceLevenshtein, scorerProduit, trouverMeilleurProduit, rechercherProduits } from './search.js';
import type { ProduitDisponible } from './types.js';

const mockProduits: ProduitDisponible[] = [
  { id: '1', designation: 'Sac de Riz Parfumé 25kg', prixVente: 17500, stockActuel: 50, categorieId: null, unite: 'sac', actif: true },
  { id: '2', designation: 'Huile Végétale Dinor 5L', prixVente: 6500, stockActuel: 20, categorieId: null, unite: 'bidon', actif: true },
  { id: '3', designation: 'Savon Madar Citron 200g', prixVente: 450, stockActuel: 100, categorieId: null, unite: 'pièce', actif: true },
  { id: '4', designation: 'Pack Eau Minérale Voltic 1.5L', prixVente: 3000, stockActuel: 15, categorieId: null, unite: 'pack', actif: true },
  { id: '5', designation: 'Sucre Blanc en Morceaux 1kg', prixVente: 900, stockActuel: 40, categorieId: null, unite: 'boîte', actif: true },
];

describe('search.ts — Fuzzy and Semantic Matcher', () => {
  it('normaliseTexte supprime accents, ponctuation et met en minuscules', () => {
    expect(normaliserTexte('HUILE Végétale (5L) !')).toBe('huile vegetale 5l');
    expect(normaliserTexte('Café & Thé')).toBe('cafe the');
  });

  it('distanceLevenshtein calcule la bonne distance d\'édition', () => {
    expect(distanceLevenshtein('savon', 'savon')).toBe(0);
    expect(distanceLevenshtein('savon', 'savonn')).toBe(1);
    expect(distanceLevenshtein('huile', 'huil')).toBe(1);
  });

  it('trouverMeilleurProduit trouve le bon produit même avec des fautes ou abréviations', () => {
    // Exact ou sous-chaîne
    expect(trouverMeilleurProduit('riz', mockProduits)?.produit.id).toBe('1');
    expect(trouverMeilleurProduit('huile', mockProduits)?.produit.id).toBe('2');

    // Fautes de frappe
    expect(trouverMeilleurProduit('savonn', mockProduits)?.produit.id).toBe('3');
    expect(trouverMeilleurProduit('huille', mockProduits)?.produit.id).toBe('2');

    // Mots partiels et accents
    expect(trouverMeilleurProduit('eau minerale', mockProduits)?.produit.id).toBe('4');
    expect(trouverMeilleurProduit('sucre', mockProduits)?.produit.id).toBe('5');
  });

  it('rechercherProduits retourne des résultats ordonnés par score', () => {
    const res = rechercherProduits('eau', mockProduits);
    expect(res.length).toBeGreaterThan(0);
    expect(res[0]?.produit.designation).toContain('Eau');
  });

  it('trouverMeilleurProduit renvoie null si aucun produit ne correspond', () => {
    expect(trouverMeilleurProduit('ordinateur portable macbook', mockProduits, 0.6)).toBeNull();
  });
});
