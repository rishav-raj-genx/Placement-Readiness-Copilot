'use client';

import React, { useState, useRef, useEffect, useMemo } from 'react';
import { Check, ChevronDown, PenLine, Search, Sparkles, X } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { filterRoles, OTHER_OPTION, STANDARD_ROLES } from '@/lib/roles';

interface RoleComboboxProps {
  value: string;
  onChange: (value: string) => void;
}

export function RoleCombobox({ value, onChange }: RoleComboboxProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [isCustomMode, setIsCustomMode] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const customInputRef = useRef<HTMLInputElement>(null);

  // Sync custom mode if value is not in the standard list and not empty
  useEffect(() => {
    if (value && !STANDARD_ROLES.includes(value as (typeof STANDARD_ROLES)[number])) {
      setIsCustomMode(true);
    }
  }, [value]);

  // Handle outside click to close dropdown
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Focus search input when dropdown opens
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => {
        searchInputRef.current?.focus();
      }, 50);
    } else {
      setSearchQuery('');
    }
  }, [isOpen]);

  // Focus custom input when custom mode is activated
  useEffect(() => {
    if (isCustomMode) {
      customInputRef.current?.focus();
    }
  }, [isCustomMode]);

  const filteredStandardRoles = useMemo(() => {
    return filterRoles(searchQuery);
  }, [searchQuery]);

  const handleSelectStandard = (role: string) => {
    onChange(role);
    setIsCustomMode(false);
    setIsOpen(false);
  };

  const handleSelectOther = () => {
    setIsCustomMode(true);
    setIsOpen(false);
    // If currently selected value is standard, clear it for custom entry
    if (STANDARD_ROLES.includes(value as (typeof STANDARD_ROLES)[number])) {
      onChange('');
    }
  };

  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation();
    onChange('');
    setIsCustomMode(false);
  };

  return (
    <div ref={containerRef} className="relative w-full space-y-2">
      {/* Combobox Trigger Button */}
      <button
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        aria-expanded={isOpen}
        aria-haspopup="listbox"
        className="flex h-10 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
      >
        <span className={`truncate ${value ? 'text-foreground font-medium' : 'text-muted-foreground'}`}>
          {value || 'Select target role...'}
        </span>
        <div className="flex items-center gap-1.5 shrink-0 text-muted-foreground">
          {value && (
            <span
              role="button"
              tabIndex={0}
              onClick={handleClear}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  handleClear(e as unknown as React.MouseEvent);
                }
              }}
              className="rounded-full p-0.5 hover:bg-white/10 hover:text-foreground"
              aria-label="Clear role"
            >
              <X className="h-3.5 w-3.5" />
            </span>
          )}
          <ChevronDown className={`h-4 w-4 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} />
        </div>
      </button>

      {/* Dropdown Popover */}
      {isOpen && (
        <div className="absolute left-0 top-full z-50 mt-1.5 w-full rounded-xl border border-white/10 bg-[#0E1524] p-2 shadow-2xl backdrop-blur-xl animate-in fade-in-0 zoom-in-95">
          {/* Search Input */}
          <div className="relative mb-2">
            <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
            <input
              ref={searchInputRef}
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search roles..."
              className="h-8 w-full rounded-lg border border-white/10 bg-white/[0.04] pl-8 pr-3 text-xs text-white placeholder:text-muted-foreground focus:border-indigo-400/50 focus:outline-none focus:ring-1 focus:ring-indigo-400/50"
            />
          </div>

          <div className="max-h-60 overflow-y-auto space-y-1 pr-1" role="listbox">
            {/* The "Other" Rule (CRITICAL): Pinned to the absolute top of the dropdown list AT ALL TIMES */}
            <button
              type="button"
              role="option"
              aria-selected={isCustomMode}
              onClick={handleSelectOther}
              className={`flex w-full items-center justify-between rounded-lg px-3 py-2 text-left text-xs font-semibold transition-colors ${
                isCustomMode
                  ? 'bg-indigo-600/30 text-indigo-200 border border-indigo-500/40'
                  : 'bg-indigo-500/10 text-indigo-300 border border-indigo-500/20 hover:bg-indigo-500/20'
              }`}
            >
              <span className="flex items-center gap-2">
                <PenLine className="h-3.5 w-3.5 text-cyan-400 shrink-0" />
                <span>{OTHER_OPTION}</span>
              </span>
              {isCustomMode && <Check className="h-3.5 w-3.5 text-cyan-400 shrink-0" />}
            </button>

            {/* Standard Filtered Roles */}
            {filteredStandardRoles.length > 0 ? (
              filteredStandardRoles.map((role) => {
                const isSelected = value === role && !isCustomMode;
                return (
                  <button
                    key={role}
                    type="button"
                    role="option"
                    aria-selected={isSelected}
                    onClick={() => handleSelectStandard(role)}
                    className={`flex w-full items-center justify-between rounded-lg px-3 py-2 text-left text-xs transition-colors ${
                      isSelected
                        ? 'bg-white/10 font-medium text-white'
                        : 'text-white/80 hover:bg-white/[0.06] hover:text-white'
                    }`}
                  >
                    <span>{role}</span>
                    {isSelected && <Check className="h-3.5 w-3.5 text-indigo-400 shrink-0" />}
                  </button>
                );
              })
            ) : (
              <div className="px-3 py-3 text-center text-xs text-muted-foreground">
                No standard match. Choose <span className="text-indigo-300 font-medium">&quot;Other&quot;</span> above to specify your custom role.
              </div>
            )}
          </div>
        </div>
      )}

      {/* Custom Input Field: Dynamically displayed when 'Other' is selected or custom role is active */}
      {isCustomMode && (
        <div className="relative pt-1 animate-in fade-in-50 slide-in-from-top-1">
          <div className="flex items-center justify-between mb-1">
            <span className="text-[11px] font-medium text-indigo-300 flex items-center gap-1">
              <Sparkles className="h-3 w-3 text-cyan-400" />
              Custom role name:
            </span>
            <button
              type="button"
              onClick={() => {
                setIsCustomMode(false);
                onChange('');
                setIsOpen(true);
              }}
              className="text-[11px] text-muted-foreground hover:text-white transition-colors"
            >
              Choose standard role
            </button>
          </div>
          <Input
            ref={customInputRef}
            type="text"
            value={value}
            onChange={(e) => onChange(e.target.value)}
            placeholder="e.g. Distributed Systems Engineer"
            className="border-indigo-500/40 bg-indigo-500/[0.05] focus-visible:ring-indigo-500"
          />
        </div>
      )}
    </div>
  );
}
