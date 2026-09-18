import React, { useState, useEffect, useRef } from 'react';
import { formatRupiahNumber, parseIndonesianNumber } from '../utils/calculations';

export interface PercentInputProps {
  id?: string;
  value: number;
  onChange: (val: number) => void;
  placeholder?: string;
  className?: string;
  disabled?: boolean;
  min?: number;
  max?: number;
  title?: string;
  'aria-label'?: string;
}

export const PercentInput: React.FC<PercentInputProps> = ({
  id,
  value,
  onChange,
  placeholder = '0,00',
  className = '',
  disabled = false,
  min = 0,
  max = 100,
  title,
  'aria-label': ariaLabel,
}) => {
  const [isFocused, setIsFocused] = useState(false);
  const [displayText, setDisplayText] = useState<string>(() =>
    value !== undefined && value !== null ? formatRupiahNumber(value, 2) : '0,00'
  );
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!isFocused) {
      setDisplayText(formatRupiahNumber(value || 0, 2));
    }
  }, [value, isFocused]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value;

    if (!raw.trim()) {
      setDisplayText('');
      onChange(0);
      return;
    }

    // Allow digits, comma and dot for percentages
    const clean = raw.replace(/[^\d.,]/g, '');
    const sepIdx = Math.max(clean.lastIndexOf(','), clean.lastIndexOf('.'));

    let intPart = '';
    let decPart = '';
    let hasDec = false;

    if (sepIdx !== -1) {
      hasDec = true;
      intPart = clean.slice(0, sepIdx).replace(/[^\d]/g, '').replace(/^0+(?=\d)/, '') || '0';
      decPart = clean.slice(sepIdx + 1).replace(/[^\d]/g, '').slice(0, 2);
    } else {
      intPart = clean.replace(/[^\d]/g, '').replace(/^0+(?=\d)/, '');
    }

    let text = intPart;
    if (hasDec) {
      text = `${intPart || '0'},${decPart}`;
    }

    setDisplayText(text);

    const numStr = `${intPart || '0'}.${decPart || '0'}`;
    let val = parseFloat(numStr) || 0;
    if (min !== undefined && val < min) val = min;
    if (max !== undefined && val > max) val = max;

    onChange(Math.round(val * 100) / 100);
  };

  const handleFocus = (e: React.FocusEvent<HTMLInputElement>) => {
    setIsFocused(true);
    const target = e.target;

    // Clear 0 to allow easy direct entry
    if (!value || value === 0) {
      setDisplayText('');
    } else if (value % 1 === 0) {
      setDisplayText(value.toString());
    } else {
      setDisplayText(formatRupiahNumber(value, 2));
    }

    setTimeout(() => {
      target.select();
    }, 50);
  };

  const handleBlur = () => {
    setIsFocused(false);
    const parsed = parseIndonesianNumber(displayText);
    let finalVal = parsed;
    if (min !== undefined && finalVal < min) finalVal = min;
    if (max !== undefined && finalVal > max) finalVal = max;

    const rounded = Math.round(finalVal * 100) / 100;
    setDisplayText(formatRupiahNumber(rounded, 2));
    onChange(rounded);
  };

  return (
    <input
      ref={inputRef}
      id={id}
      type="text"
      inputMode="decimal"
      value={displayText}
      onChange={handleChange}
      onFocus={handleFocus}
      onBlur={handleBlur}
      placeholder={placeholder}
      className={className}
      disabled={disabled}
      title={title}
      aria-label={ariaLabel}
      autoComplete="off"
    />
  );
};
