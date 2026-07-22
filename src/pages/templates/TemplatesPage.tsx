import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Store, Download, Upload, Filter, Sparkles, Package } from 'lucide-react';
import toast from 'react-hot-toast';
import { templatesApi } from '@/lib/api';
import type { TemplateItem } from '@/lib/api';

export default function TemplatesPage() {
  const [templates, setTemplates] = useState<TemplateItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [secteurFilter, setSecteurFilter] = useState('');
  const [importingId, setImportingId] = useState<string | null>(null);

  const fetchTemplates = async () => {
    setLoading(true);
    try {
      const items = await templatesApi.list(secteurFilter || undefined);
      setTemplates(Array.isArray(items) ? items : []);
    } catch {
      toast.error('Erreur lors du chargement de la marketplace de templates');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTemplates();
  }, [secteurFilter]);

  const handleImport = async (templateId: string, nom: string) => {
    if (!confirm(`Voulez-vous importer le template "${nom}" dans votre boutique ?`)) return;

    setImportingId(templateId);
    try {
      const result = await templatesApi.import(templateId);
      toast.success(
        `Importation réussie ! (${result.categoriesImportees || 0} catégories, ${result.produitsImportes || 0} produits créés)`,
        { duration: 5000 }
      );
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Erreur lors de l\'importation';
      toast.error(msg);
    } finally {
      setImportingId(null);
    }
  };

  return (
    <div className="max-w-6xl mx-auto space-y-6 animate-fadeIn">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Store className="text-amber-600" size={26} />
            Marketplace de Templates de Catalogue
          </h1>
          <p className="text-xs text-gray-500 mt-1">
            Importez des structures de produits prêtes à l'emploi ou partagez vos propres catalogues.
          </p>
        </div>
        <Link
          to="/templates/exporter"
          className="px-4 py-2.5 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs font-semibold flex items-center gap-2 shadow-sm transition-all self-start md:self-auto"
        >
          <Upload size={15} /> Exporter mon Catalogue
        </Link>
      </div>

      {/* Filter */}
      <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm flex items-center gap-3">
        <Filter size={16} className="text-gray-400 shrink-0" />
        <select
          value={secteurFilter}
          onChange={(e) => setSecteurFilter(e.target.value)}
          className="px-3 py-1.5 text-xs border border-gray-300 rounded-lg focus:ring-1 focus:ring-amber-500"
        >
          <option value="">Tous les secteurs d'activité</option>
          <option value="mode">Mode & Habillement</option>
          <option value="electromenager">Électronique & Électroménager</option>
          <option value="cosmetique">Cosmétique & Beauté</option>
          <option value="epicerie">Épicerie & Alimentation</option>
          <option value="quincaillerie">Quincaillerie & Bricolage</option>
        </select>
      </div>

      {/* Templates Grid */}
      {loading ? (
        <div className="py-16 text-center text-xs text-gray-500">Chargement des templates de catalogue...</div>
      ) : templates.length === 0 ? (
        <div className="bg-white rounded-2xl p-12 text-center border border-gray-200 shadow-sm space-y-3">
          <Sparkles className="mx-auto text-amber-500" size={32} />
          <h3 className="text-sm font-bold text-gray-900">Aucun template disponible</h3>
          <p className="text-xs text-gray-500 max-w-sm mx-auto">
            Soyez le premier à publier un template de catalogue pour votre secteur d'activité !
          </p>
          <Link
            to="/templates/exporter"
            className="inline-flex items-center gap-1.5 text-xs text-amber-600 font-semibold hover:underline pt-2"
          >
            Publier un template <Upload size={14} />
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {templates.map((tpl) => {
            const catCount = tpl.payload?.categories?.length || 0;
            const prodCount = tpl.payload?.produits?.length || 0;
            const isImporting = importingId === tpl.id;

            return (
              <div
                key={tpl.id}
                className="bg-white rounded-2xl border border-gray-200 p-6 flex flex-col justify-between shadow-sm hover:shadow-md transition-shadow"
              >
                <div className="space-y-3">
                  <div className="flex items-start justify-between">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-amber-600 bg-amber-50 px-2.5 py-1 rounded-full border border-amber-200">
                      {tpl.secteurActivite || 'Général'}
                    </span>
                    <span className="text-[11px] text-gray-400">
                      {new Date(tpl.createdAt).toLocaleDateString('fr-FR')}
                    </span>
                  </div>

                  <h3 className="text-base font-bold text-gray-900 leading-snug">{tpl.nom}</h3>
                  <p className="text-xs text-gray-600 line-clamp-2">
                    {tpl.description || 'Structure de catalogue complète avec produits et catégories pré-configurés.'}
                  </p>

                  <div className="pt-2 flex items-center gap-4 text-xs text-gray-500">
                    <span className="flex items-center gap-1">
                      <Package size={14} className="text-amber-500" /> {prodCount} produits
                    </span>
                    <span>•</span>
                    <span>{catCount} catégories</span>
                  </div>
                </div>

                <div className="pt-6">
                  <button
                    disabled={isImporting}
                    onClick={() => handleImport(tpl.id, tpl.nom)}
                    className="w-full py-2.5 bg-gray-900 hover:bg-gray-800 text-white rounded-xl text-xs font-semibold flex items-center justify-center gap-2 transition-colors disabled:opacity-50"
                  >
                    {isImporting ? 'Importation...' : <><Download size={14} /> Importer ce catalogue</>}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
