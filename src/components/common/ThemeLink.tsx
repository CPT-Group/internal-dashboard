'use client';

import { useEffect } from 'react';

export const ThemeLink = () => {
  useEffect(() => {
    // Create or get the theme link element
    const linkId = 'theme-stylesheet';
    let linkElement = document.getElementById(linkId) as HTMLLinkElement;

    if (!linkElement) {
      linkElement = document.createElement('link');
      linkElement.id = linkId;
      linkElement.rel = 'stylesheet';
      document.head.appendChild(linkElement);
    }

    // Get theme from localStorage or default to dark
    const savedTheme = localStorage.getItem('cpt-theme') || 'dark';
    const themePath = savedTheme === 'light' 
      ? '/themes/cpt-legacy-light/theme.css'
      : '/themes/cpt-legacy-dark/theme.css';
    
    linkElement.href = themePath;
    document.documentElement.setAttribute('data-theme', savedTheme);
  }, []);

  return null;
};
