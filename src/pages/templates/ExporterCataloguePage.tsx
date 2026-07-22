import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Upload, ArrowLeft, Store, Sparkles, CheckCircle2 } from 'lucide-react';
import toast from 'react-hot-toast';
import { api } from '@/lib/api';

export default function ExporterCataloguePage() {
  const navigate = useNavigate();
  const [nom, setNom] = useState('');
  const [description, setDescription] = useState('');
  const [secteurActivite, setSecteurActivite] = useState('mode');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nom.trim()) {
      toast.error('Le nom du template est requis');
      return;
    }

    setLoading(true);
    try {
      await api.post('/api/templates', {
        nom,
        description,
        secteurActivite,
      });

      toast.success('Votre catalogue a été exporté sous forme de template avec succès !');
      navigate('/templates');
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Erreur lors de l\'exportation du catalogue');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6 animate-fadeIn">
      {/* Header */}
      <div>
        <Link
          to="/templates"
          className="inline-flex items-center gap-1.5 text-xs text-gray-500 hover:text-gray-900 mb-3 transition-colors"
        >
          <ArrowLeft size={14} /> Retour à la marketplace
        </Link>
        <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
          <Upload className="text-amber-600" size={26} />
          Exporter mon Catalogue en Template
        </h1>
        <p className="text-xs text-gray-500 mt-1">
          Partagez la structure de vos catégories et produits avec d'autres commerçants (aucune donnée client ou financière n'est transmise).
        </p>
      </div>

      {/* Info Card */}
      <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 text-xs text-amber-900 space-y-2">
        <div className="flex items-center gap-2 font-semibold">
          <Sparkles size={16} className="text-amber-600" />
          Que contient l'exportation ?
        </div>
        <ul className="space-y-1 pl-6 list-disc text-amber-800">
          <li>Les noms et descriptions de vos catégories.</li>
          <li>Les désignations, références et prix indicatifs de vos produits.</li>
          <li><strong>Exclu :</strong> Données clients, factures, réglements, fournisseurs et ventes.</li>
        </ul>
      </div>

      {/* Form Card */}
      <form onSubmit={handleSubmit} className="bg-white rounded-2xl border border-gray-200 p-6 shadow-sm space-y-5">
        <div>
          <label className="block text-xs font-semibold text-gray-700 mb-1">
            Nom du Template <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            required
            value={nom}
            onChange={(e) => setNom(e.target.value)}
            placeholder="Ex: Catalogue Boutique Prêt-à-porter Féminin"
            className="w-full px-3 py-2 text-sm border border-gray-300 rounded-xl focus:ring-2 focus:ring-amber-500"
          />
        </div>

        <div>
          <label className="block text-xs font-semibold text-gray-700 mb-1">
            Secteur d'Activité <span className="text-red-500">*</span>
          </label>
          <select
            value={secteurActivite}
            onChange={(e) => setSecteurActivite(e.target.value)}
            className="w-full px-3 py-2 text-sm border border-gray-300 rounded-xl focus:ring-2 focus:ring-amber-500"
          >
            <option value="mode">Mode & Habillement</option>
            <option value="electromenager">Électronique & Électroménager</option>
            <option value="cosmetique">Cosmétique & Beauté</option>
            <option value="epicerie">Épicerie & Alimentation</option>
            <option value="quincaillerie">Quincaillerie & Bricolage</option>
            <option value="autre">Autre secteur</option>
          </select>
        </div>

        <div>
          <label className="block text-xs font-semibold text-gray-700 mb-1">Description du Template</label>
          <textarea
            rows={4}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Décrivez en quelques lignes ce que contient ce catalogue (ex: plus de 50 références d'habillement avec catégories été/hiver...)"
            className="w-full px-3 py-2 text-sm border border-gray-300 rounded-xl focus:ring-2 focus:ring-amber-500"
          />
        </div>

        <div className="pt-2 flex justify-end gap-3">
          <Link
            to="/templates"
            className="px-4 py-2 text-xs font-semibold text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-xl transition-colors"
          >
            Annuler
          </Link>
          <button
            type="submit"
            disabled={loading}
            className="px-5 py-2 text-xs font-semibold text-white bg-amber-600 hover:bg-amber-700 rounded-xl transition-colors shadow-sm disabled:opacity-50 flex items-center gap-1.5"
          >
            {loading ? 'Publication...' : 'Publier le Template'}
          </button>
        </div>
      </form>
    </div>
  );
}
