/**
 * Données de pays et villes pour le formulaire de profil
 * Utilise la librairie country-state-city pour une couverture mondiale
 */
import { Country as CountryLib, City as CityLib } from 'country-state-city';

export interface Country {
    code: string; // Code ISO 3166-1 alpha-2
    name: string; // Nom
    dialCode: string; // Code téléphonique (ex: +243)
    flag: string; // Emoji drapeau
}

export interface City {
    name: string;
    countryCode: string;
}

// Mapping manuel pour les noms en français de certains pays fréquents
// La librairie est en anglais par défaut
const FRENCH_NAMES: Record<string, string> = {
    'CD': 'République Démocratique du Congo',
    'CG': 'République du Congo',
    'BF': 'Burkina Faso',
    'CM': 'Cameroun',
    'CI': "Côte d'Ivoire",
    'SN': 'Sénégal',
    'ML': 'Mali',
    'NE': 'Niger',
    'TD': 'Tchad',
    'GA': 'Gabon',
    'BJ': 'Bénin',
    'TG': 'Togo',
    'CF': 'République Centrafricaine',
    'RW': 'Rwanda',
    'BI': 'Burundi',
    'DJ': 'Djibouti',
    'KM': 'Comores',
    'MG': 'Madagascar',
    'MU': 'Maurice',
    'SC': 'Seychelles',
    'FR': 'France',
    'BE': 'Belgique',
    'CH': 'Suisse',
    'CA': 'Canada',
    'LU': 'Luxembourg',
    'MC': 'Monaco',
    'DZ': 'Algérie',
    'MA': 'Maroc',
    'TN': 'Tunisie',
    'EG': 'Égypte',
    'ZA': 'Afrique du Sud',
    'US': 'États-Unis',
    'GB': 'Royaume-Uni',
    'DE': 'Allemagne',
    'IT': 'Italie',
    'ES': 'Espagne',
    'PT': 'Portugal',
    'NL': 'Pays-Bas',
    'SE': 'Suède',
    'NO': 'Norvège',
    'DK': 'Danemark',
    'FI': 'Finlande',
    'PL': 'Pologne',
    'CZ': 'République Tchèque',
    'AT': 'Autriche',
    'GR': 'Grèce',
    'TR': 'Turquie',
    'RU': 'Russie',
    'CN': 'Chine',
    'JP': 'Japon',
    'KR': 'Corée du Sud',
    'IN': 'Inde',
    'BR': 'Brésil',
    'AE': 'Émirats Arabes Unis',
    'SA': 'Arabie Saoudite',
    'IL': 'Israël',
    'LB': 'Liban',
    'JO': 'Jordanie',
};

/**
 * Liste de tous les pays, triés alphabétiquement par nom (français si dispo, sinon anglais)
 */
export const COUNTRIES: Country[] = CountryLib.getAllCountries().map(c => ({
    code: c.isoCode,
    name: FRENCH_NAMES[c.isoCode] || c.name,
    dialCode: c.phonecode.startsWith('+') ? c.phonecode : `+${c.phonecode}`,
    flag: c.flag,
})).sort((a, b) => a.name.localeCompare(b.name, 'fr'));

/**
 * Récupère le nom d'un pays à partir de son code ISO
 */
export const getCountryName = (code: string): string => {
    const country = COUNTRIES.find(c => c.code === code);
    return country?.name || code;
};

/**
 * Récupère le code téléphonique d'un pays à partir de son code ISO
 */
export const getCountryDialCode = (code: string): string => {
    const country = COUNTRIES.find(c => c.code === code);
    return country?.dialCode || '';
};

/**
 * Récupère le drapeau (emoji) d'un pays
 */
export const getCountryFlag = (code: string): string => {
    const country = COUNTRIES.find(c => c.code === code);
    return country?.flag || '🌍';
};

/**
 * Récupère la liste des villes pour un pays donné
 */
export const getCitiesByCountry = (countryCode: string): string[] => {
    const cities = CityLib.getCitiesOfCountry(countryCode);
    if (!cities || cities.length === 0) return ['Autre'];

    // Trier et retourner les noms uniques
    return [...new Set(cities.map(c => c.name))].sort((a, b) => a.localeCompare(b));
};

/**
 * Vérifie si un pays a une liste de villes (toujours vrai avec la lib, sauf si vide)
 */
export const hasCustomCities = (countryCode: string): boolean => {
    const cities = CityLib.getCitiesOfCountry(countryCode);
    return cities && cities.length > 0;
};

/**
 * Liste de tous les codes de pays
 */
export const COUNTRY_CODES = COUNTRIES.map(c => c.code);
