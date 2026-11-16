/** Marcas y líneas comunes en Colombia. "Otra" permite escribir libremente. */
export const MARCAS: Record<string, string[]> = {
  Renault: ["Sandero", "Stepway", "Logan", "Duster", "Kwid", "Koleos", "Captur", "Clio", "Symbol", "Twingo", "Kangoo", "Oroch", "Alaskan", "Arkana"],
  Chevrolet: ["Spark", "Spark GT", "Beat", "Sail", "Onix", "Aveo", "Optra", "Joy", "Tracker", "Captiva", "Cruze", "Equinox", "N300", "D-Max", "Colorado"],
  Mazda: ["Mazda 2", "Mazda 3", "Mazda 6", "CX-3", "CX-30", "CX-5", "CX-50", "CX-9", "BT-50", "Allegro"],
  Kia: ["Picanto", "Rio", "Soluto", "Cerato", "Stonic", "Seltos", "Sportage", "Sorento", "Niro"],
  Hyundai: ["i10", "Grand i10", "Accent", "i25", "Elantra", "Venue", "Creta", "Kona", "Tucson", "Santa Fe"],
  Toyota: ["Yaris", "Corolla", "Corolla Cross", "RAV4", "Fortuner", "Prado", "Land Cruiser", "Hilux"],
  Nissan: ["March", "Versa", "Sentra", "Tiida", "Kicks", "Qashqai", "X-Trail", "Frontier"],
  Volkswagen: ["Gol", "Voyage", "Polo", "Virtus", "Jetta", "Nivus", "T-Cross", "Tiguan", "Amarok"],
  Ford: ["Fiesta", "Focus", "EcoSport", "Escape", "Territory", "Explorer", "Ranger"],
  Suzuki: ["Alto", "Celerio", "Swift", "Dzire", "Ertiga", "Vitara", "Grand Vitara", "S-Cross", "Jimny"],
  Mitsubishi: ["Lancer", "Mirage", "ASX", "Xpander", "Outlander", "Montero Sport", "L200"],
  Honda: ["Fit", "City", "Civic", "WR-V", "HR-V", "CR-V"],
  Peugeot: ["208", "2008", "301", "308", "3008", "5008", "Partner"],
  Citroën: ["C3", "C4 Cactus", "C5 Aircross", "Berlingo"],
  Fiat: ["Uno", "Palio", "Mobi", "Argo", "Cronos", "Strada", "Fiorino"],
  Jeep: ["Renegade", "Compass", "Cherokee", "Grand Cherokee", "Wrangler"],
  Subaru: ["Impreza", "XV", "Forester", "Outback"],
  BYD: ["Dolphin", "Dolphin Mini", "Seal", "Yuan Plus", "Song Plus", "Han"],
  Chery: ["Tiggo 2", "Tiggo 4", "Tiggo 7", "Tiggo 8"],
  JAC: ["S2", "S3", "JS4", "T6", "T8"],
  DFSK: ["Glory 500", "Glory 580", "C31", "C35"],
  "Great Wall / Haval": ["H6", "Jolion", "Wingle", "Poer"],
  Daihatsu: ["Terios", "Sirion"],
  Skoda: ["Fabia", "Octavia", "Kamiq"],
  BMW: [], "Mercedes-Benz": [], Audi: [], Volvo: [],
};
export const LISTA_MARCAS = Object.keys(MARCAS).sort((a, b) => a.localeCompare(b, "es"));

export const COLORES: { nombre: string; hex: string }[] = [
  { nombre: "Blanco", hex: "#ffffff" }, { nombre: "Negro", hex: "#111111" },
  { nombre: "Gris", hex: "#7a7f86" }, { nombre: "Plata", hex: "#c9ccd1" },
  { nombre: "Rojo", hex: "#c0262d" }, { nombre: "Vinotinto", hex: "#6b1420" },
  { nombre: "Azul", hex: "#1f4fa3" }, { nombre: "Verde", hex: "#2f7d4a" },
  { nombre: "Beige", hex: "#d8c7a3" }, { nombre: "Café", hex: "#6a4a2f" },
  { nombre: "Amarillo", hex: "#e8b51c" }, { nombre: "Naranja", hex: "#e06a1a" },
];

export const COMBUSTIBLES = [
  { id: "gasolina", nombre: "Gasolina" }, { id: "diesel", nombre: "Diésel (ACPM)" },
  { id: "gas", nombre: "Gas (GNV)" }, { id: "hibrido", nombre: "Híbrido" },
  { id: "electrico", nombre: "Eléctrico" }, { id: "nose", nombre: "No sé" },
];

export const TIPOS_DOCUMENTO = [
  { id: "CC", nombre: "Cédula de ciudadanía" }, { id: "CE", nombre: "Cédula de extranjería" },
  { id: "NIT", nombre: "NIT (empresa)" }, { id: "PAS", nombre: "Pasaporte" },
];
