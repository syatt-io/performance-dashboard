'use client';

import { useState } from 'react';
import { Calendar, ChevronDown } from 'lucide-react';

interface DateRangePickerProps {
  value: {
    startDate: string | null;
    endDate: string | null;
    timeRange: '1h' | '24h' | '7d' | '30d' | '90d' | 'custom';
  };
  onChange: (value: {
    startDate: string | null;
    endDate: string | null;
    timeRange: '1h' | '24h' | '7d' | '30d' | '90d' | 'custom';
  }) => void;
  showTimeRanges?: boolean;
}

const timeRangeOptions = [
  { value: '1h', label: 'Last Hour' },
  { value: '24h', label: 'Last 24 Hours' },
  { value: '7d', label: 'Last 7 Days' },
  { value: '30d', label: 'Last 30 Days' },
  { value: '90d', label: 'Last 90 Days' },
  { value: 'custom', label: 'Custom Range' }
];

export default function DateRangePicker({
  value,
  onChange,
  showTimeRanges = true
}: DateRangePickerProps) {
  const [isOpen, setIsOpen] = useState(false);

  const handleTimeRangeChange = (timeRange: string) => {
    if (timeRange === 'custom') {
      // Set default custom range to last 7 days
      const endDate = new Date().toISOString().split('T')[0];
      const startDate = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
      onChange({
        timeRange: 'custom',
        startDate,
        endDate
      });
    } else {
      onChange({
        timeRange: timeRange as any,
        startDate: null,
        endDate: null
      });
    }
    setIsOpen(false);
  };

  const handleCustomDateChange = (field: 'startDate' | 'endDate', date: string) => {
    onChange({
      ...value,
      [field]: date
    });
  };

  const formatDisplayValue = () => {
    if (value.timeRange === 'custom' && value.startDate && value.endDate) {
      const start = new Date(value.startDate).toLocaleDateString();
      const end = new Date(value.endDate).toLocaleDateString();
      return `${start} - ${end}`;
    }
    return timeRangeOptions.find(opt => opt.value === value.timeRange)?.label || 'Select Range';
  };

  return (
    <div className="relative">
      {/* Main Dropdown Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center space-x-2 px-3 py-2 bg-white border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500"
      >
        <Calendar className="w-4 h-4" />
        <span>{formatDisplayValue()}</span>
        <ChevronDown className="w-4 h-4" />
      </button>

      {/* Dropdown Menu */}
      {isOpen && (
        <div className="absolute right-0 z-10 mt-2 w-80 bg-white border border-gray-200 rounded-md shadow-lg">
          <div className="p-4">
            {showTimeRanges && (
              <div className="mb-4">
                <h3 className="text-sm font-medium text-gray-900 mb-2">Quick Ranges</h3>
                <div className="grid grid-cols-2 gap-2">
                  {timeRangeOptions.slice(0, -1).map((option) => (
                    <button
                      key={option.value}
                      onClick={() => handleTimeRangeChange(option.value)}
                      className={`px-3 py-2 text-sm rounded border ${
                        value.timeRange === option.value
                          ? 'bg-blue-50 border-blue-200 text-blue-700'
                          : 'bg-gray-50 border-gray-200 text-gray-700 hover:bg-gray-100'
                      }`}
                    >
                      {option.label}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div className="border-t pt-4">
              <h3 className="text-sm font-medium text-gray-900 mb-2">Custom Range</h3>
              <div className="grid grid-cols-1 gap-3">
                <div>
                  <label htmlFor="startDate" className="block text-xs font-medium text-gray-700 mb-1">
                    Start Date
                  </label>
                  <input
                    type="date"
                    id="startDate"
                    value={value.startDate || ''}
                    onChange={(e) => {
                      handleCustomDateChange('startDate', e.target.value);
                      onChange({
                        ...value,
                        timeRange: 'custom',
                        startDate: e.target.value
                      });
                    }}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label htmlFor="endDate" className="block text-xs font-medium text-gray-700 mb-1">
                    End Date
                  </label>
                  <input
                    type="date"
                    id="endDate"
                    value={value.endDate || ''}
                    onChange={(e) => {
                      handleCustomDateChange('endDate', e.target.value);
                      onChange({
                        ...value,
                        timeRange: 'custom',
                        endDate: e.target.value
                      });
                    }}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              {value.timeRange === 'custom' && value.startDate && value.endDate && (
                <div className="mt-3 flex justify-end">
                  <button
                    onClick={() => setIsOpen(false)}
                    className="px-4 py-2 bg-blue-600 text-white text-sm rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    Apply
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Overlay to close dropdown */}
      {isOpen && (
        <div
          className="fixed inset-0 z-0"
          onClick={() => setIsOpen(false)}
        />
      )}
    </div>
  );
}