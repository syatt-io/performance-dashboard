'use client';

import React, { memo, useCallback } from 'react';
import { Site } from '../../lib/api';

interface SiteModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (siteData: { name: string; url: string; shopifyDomain: string }) => void;
  title: string;
  submitText: string;
  site?: Site | null;
  initialData: {
    name: string;
    url: string;
    shopifyDomain: string;
  };
  onDataChange: (data: { name: string; url: string; shopifyDomain: string }) => void;
}

const SiteModal = memo(function SiteModal({
  isOpen,
  onClose,
  onSubmit,
  title,
  submitText,
  initialData,
  onDataChange
}: SiteModalProps) {
  const handleSubmit = useCallback((e: React.FormEvent) => {
    e.preventDefault();
    onSubmit(initialData);
  }, [onSubmit, initialData]);

  const handleInputChange = useCallback((field: keyof typeof initialData, value: string) => {
    onDataChange({ ...initialData, [field]: value });
  }, [initialData, onDataChange]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg p-6 w-full max-w-md">
        <h3 className="text-lg font-semibold mb-4">{title}</h3>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Site Name
            </label>
            <input
              type="text"
              value={initialData.name}
              onChange={(e) => handleInputChange('name', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="My Store"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              URL
            </label>
            <input
              type="url"
              value={initialData.url}
              onChange={(e) => handleInputChange('url', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="https://my-store.myshopify.com"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Shopify Domain (optional)
            </label>
            <input
              type="text"
              value={initialData.shopifyDomain}
              onChange={(e) => handleInputChange('shopifyDomain', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="my-store"
            />
          </div>

          <div className="flex justify-end space-x-3 mt-6">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-gray-700 border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-gray-500"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {submitText}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
});

export default SiteModal;