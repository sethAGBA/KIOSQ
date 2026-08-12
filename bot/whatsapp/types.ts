// Session state machine steps
export type SessionStep =
  | 'ACCUEIL'
  | 'IDENTIFICATION'
  | 'MENU_PRINCIPAL'
  | 'CATALOGUE'
  | 'PANIER'
  | 'CONFIRMATION'
  | 'SUIVI';

// A single line item in the shopping cart
export interface LignePanier {
  produitId: string;
  designation: string;
  prixUnitaire: number; // in the tenant's currency unit
  quantite: number;
  totalLigne: number; // prixUnitaire * quantite
}

// Conversational session for one WhatsApp number
export interface Session {
  phone: string;              // normalised WhatsApp number (E.164 without +)
  clientId: string | null;
  clientNom: string | null;
  step: SessionStep;
  panier: LignePanier[];
  tvaRate: number;            // tenant TVA rate (e.g. 18)
  devise: string;             // tenant currency (e.g. "XOF")
  lastActivity: number;       // Date.now() at last message
  pendingNomCapture: boolean; // true while waiting for a new client's name
}

// ─── WhatsApp Cloud API webhook payloads ─────────────────────────────────────

export interface WhatsAppWebhookPayload {
  object: string; // "whatsapp_business_account"
  entry: Array<{
    id: string;
    changes: Array<{
      value: {
        messaging_product: string;
        metadata: { display_phone_number: string; phone_number_id: string };
        contacts?: Array<{ profile: { name: string }; wa_id: string }>;
        messages?: Array<IncomingMessage>;
        statuses?: Array<MessageStatus>;
      };
      field: string;
    }>;
  }>;
}

export interface IncomingMessage {
  from: string;   // sender number (E.164 without +)
  id: string;     // unique wamid
  timestamp: string;
  type: 'text' | 'image' | 'document' | 'audio' | 'video' | 'sticker' | 'location' | 'interactive';
  text?: { body: string };
  image?: { id: string; mime_type: string; caption?: string };
  document?: { id: string; filename?: string; caption?: string };
}

export interface MessageStatus {
  id: string;
  status: 'sent' | 'delivered' | 'read' | 'failed';
  timestamp: string;
  recipient_id: string;
}

// ─── NLU (Gemini) ─────────────────────────────────────────────────────────────

export type IntentName =
  | 'PARCOURIR_CATALOGUE'
  | 'AJOUTER_PRODUIT'
  | 'CONFIRMER_COMMANDE'
  | 'VOIR_STATUT'
  | 'MODIFIER_PANIER'
  | 'ANNULER'
  | 'AIDE'
  | 'INCONNU';

export interface NluResult {
  intent: IntentName;
  score: number;               // 0–1 confidence
  produit?: string | null;     // detected product name
  quantite?: number | null;    // detected quantity
}

// ─── Kiosq API return types ───────────────────────────────────────────────────

export interface ProduitDisponible {
  id: string;
  designation: string;
  prixVente: number;
  stockActuel: number;
  categorieId: string | null;
  unite: string;
  actif: boolean;
}

export interface ClientKiosq {
  id: string;
  nom: string;
  telephone: string | null;
  email: string | null;
  tenantId: string;
}

export interface CommandeCreee {
  id: string;
  numero: string;  // e.g. "CMD-2025-001"
  statut: string;
  totalTTC: number;
  dateCommande: string;
}

export interface ParametresTenant {
  tva: string;    // "18" by default
  devise: string; // "XOF" by default
}

export interface LigneCommande {
  produitId: string;
  produitRef: string;    // référence produit (peut être vide)
  produitNom: string;    // nom du produit
  quantite: number;
  prixUnitaire: number;
  remise: number;  // always 0 from the bot
  total: number;   // prixUnitaire * quantite
}

export interface CommandePayload {
  clientId: string | null;
  lignes: LigneCommande[];
  totalHT: number;
  tva: number;       // rate (e.g. 18)
  totalTTC: number;
  notes: string;     // "Commande via WhatsApp"
}
