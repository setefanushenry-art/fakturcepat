import React, { useState, useEffect, useRef } from 'react';
import { formatRupiahNumber, parseIndonesianNumber } from '../utils/calculations';

export interface CurrencyInputProps {
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
  autoSelectOnFocus?: boolean;
}

export const CurrencyInput: React.FC<CurrencyInputProps> = ({
  id,
  value,
  onChange,
  placeholder = '0,00',
  className = '',
  disabled = false,
  min = 0,
  max,
  title,
  'aria-label': ariaLabel,
  autoSelectOnFocus = true,
}) => {
  const [isFocused, setIsFocused] = useState(false);
  // Maintain local string representation for natural, seamless typing
  const [displayText, setDisplayText] = useState<string>(() =>
    value !== undefined && value !== null ? formatRupiahNumber(value, 2) : '0,00'
  );
  const inputRef = useRef<HTMLInputElement>(null);

  // Sync with external value changes when not focused
  useEffect(() => {
    if (!isFocused) {
      setDisplayText(formatRupiahNumber(value || 0, 2));
    }
  }, [value, isFocused]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value;

    // If cleared completely
    if (!raw.trim()) {
      setDisplayText('');
      onChange(0);
      return;
    }

    // Determine if user has typed a decimal comma (e.g. 7.356,55 or 55,)
    const commaIndex = raw.lastIndexOf(',');

    if (commaIndex !== -1) {
      // Case 1: User explicitly typed a comma for decimals (cents)
      const intRaw = raw.slice(0, commaIndex).replace(/[^\d]/g, '');
      const decRaw = raw.slice(commaIndex + 1).replace(/[^\d]/g, '').slice(0, 2);

      const cleanInt = intRaw.replace(/^0+(?=\d)/, '') || '0';
      const formattedInt = cleanInt.replace(/\B(?=(\d{3})+(?!\d))/g, '.');

      const formatted = `${formattedInt},${decRaw}`;
      setDisplayText(formatted);

      const numStr = `${cleanInt}.${decRaw || '0'}`;
      let numericVal = parseFloat(numStr) || 0;
      if (min !== undefined && numericVal < min) numericVal = min;
      if (max !== undefined && numericVal > max) numericVal = max;

      onChange(numericVal);
    } else {
      // Case 2: Whole Rupiah (ribuan / puluhan ribu / jutaan)
      // Any dots '.' in the string (typed or previous thousands dots) are stripped to read pure digits
      const digits = raw.replace(/[^\d]/g, '');

      if (!digits) {
        setDisplayText('');
        onChange(0);
        return;
      }

      // Remove leading zeros e.g. 05000 -> 5000
      const cleanDigits = digits.replace(/^0+(?=\d)/, '');

      // Automatically format with thousands dots e.g. 50000 -> "50.000"
      const formatted = cleanDigits.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
      setDisplayText(formatted);

      let numericVal = parseInt(cleanDigits, 10) || 0;
      if (min !== undefined && numericVal < min) numericVal = min;
      if (max !== undefined && numericVal > max) numericVal = max;

      onChange(numericVal);
    }
  };

  const handleFocus = (e: React.FocusEvent<HTMLInputElement>) => {
    setIsFocused(true);
    const target = e.target;

    // When user taps on 0 or empty, clear the text so they can immediately type ribuan without trapped ',00'
    if (!value || value === 0) {
      setDisplayText('');
    } else if (value % 1 === 0) {
      // Integer (no cents): show clean thousands without ',00' for convenient editing
      setDisplayText(formatRupiahNumber(value, 0));
    } else {
      // Has decimals: show with decimals
      setDisplayText(formatRupiahNumber(value, 2));
    }

    if (autoSelectOnFocus) {
      // Small timeout for Android/iOS virtual keyboard selection support
      setTimeout(() => {
        target.select();
      }, 50);
    }
  };

  const handleBlur = () => {
    setIsFocused(false);
    const parsed = parseIndonesianNumber(displayText);
    let finalVal = parsed;
    if (min !== undefined && finalVal < min) finalVal = min;
    if (max !== undefined && finalVal > max) finalVal = max;

    // Enforce 2 decimal places display on blur: e.g. 7.356,55 or 31.100,00 or 50.000,00
    setDisplayText(formatRupiahNumber(finalVal, 2));
    onChange(finalVal);
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
