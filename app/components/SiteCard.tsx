'use client';

import React, { memo, useCallback } from 'react';
import { Site } from '../lib/api';
import { Globe, Activity, AlertCircle, Trash2, Edit } from 'lucide-react';

interface SiteCardProps {
  site: Site;
  onSelect: (site: Site) => void;
  onDelete?: (site: Site) => void;
  onEdit?: (site: Site) => void;
}

const SiteCard = memo(function SiteCard({ site, onSelect, onDelete, onEdit }: SiteCardProps) {
  const getStatusColor = useCallback(() => {
    if (!site.isActive) return 'bg-gray-100 border-gray-300';
    if (site._count?.alerts && site._count.alerts > 0) return 'bg-red-50 border-red-300';
    return 'bg-green-50 border-green-300';
  }, [site.isActive, site._count?.alerts]);

  const getStatusIcon = useCallback(() => {
    if (!site.isActive) return <div className="w-2 h-2 bg-gray-400 rounded-full" />;
    if (site._count?.alerts && site._count.alerts > 0) {
      return <AlertCircle className="w-4 h-4 text-red-500" />;
    }
    return <div className="w-2 h-2 bg-green-500 rounded-full" />;
  }, [site.isActive, site._count?.alerts]);

  const handleEdit = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    onEdit?.(site);
  }, [onEdit, site]);

  const handleDelete = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    onDelete?.(site);
  }, [onDelete, site]);

  const handleSelect = useCallback(() => {
    onSelect(site);
  }, [onSelect, site]);

  return (
    <div className={`p-6 rounded-lg border-2 transition-all hover:shadow-md ${getStatusColor()}`}>
      <div
        className="cursor-pointer"
        onClick={handleSelect}
      >
      <div className="flex items-start justify-between">
        <div className="flex items-start space-x-3">
          <Globe className="w-5 h-5 text-gray-600 mt-1" />
          <div>
            <h3 className="font-semibold text-gray-900">{site.name}</h3>
            <p className="text-sm text-gray-600">{site.url}</p>
            {site.shopifyDomain && (
              <p className="text-xs text-gray-500 mt-1">Shopify: {site.shopifyDomain}</p>
            )}
          </div>
        </div>

        <div className="flex flex-col items-end space-y-2">
          {getStatusIcon()}

          <div className="flex items-center space-x-3 text-sm text-gray-600">
            {site._count?.metrics !== undefined && (
              <div className="flex items-center space-x-1">
                <Activity className="w-3 h-3" />
                <span>{site._count.metrics}</span>
              </div>
            )}

            {site._count?.alerts !== undefined && site._count.alerts > 0 && (
              <div className="flex items-center space-x-1 text-red-600">
                <AlertCircle className="w-3 h-3" />
                <span>{site._count.alerts}</span>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="mt-4 pt-4 border-t border-gray-200">
        <div className="flex justify-between items-center text-xs text-gray-500">
          <span>Added {new Date(site.createdAt).toLocaleDateString()}</span>
          <span className={site.isActive ? 'text-green-600' : 'text-gray-500'}>
            {site.isActive ? 'Active' : 'Inactive'}
          </span>
        </div>
      </div>
      </div>

      {/* Action buttons */}
      {(onEdit || onDelete) && (
        <div className="flex space-x-2 mt-4 pt-4 border-t border-gray-200">
          {onEdit && (
            <button
              onClick={handleEdit}
              className="flex items-center space-x-1 px-3 py-1 text-sm text-gray-600 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors"
            >
              <Edit className="w-3 h-3" />
              <span>Edit</span>
            </button>
          )}
          {onDelete && (
            <button
              onClick={handleDelete}
              className="flex items-center space-x-1 px-3 py-1 text-sm text-gray-600 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
            >
              <Trash2 className="w-3 h-3" />
              <span>Delete</span>
            </button>
          )}
        </div>
      )}
    </div>
  );
});

export default SiteCard;