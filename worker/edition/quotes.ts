import type { Language } from "../../shared/types";

/** Proverbes et dictons français traditionnels (domaine public). */
const QUOTES_FR = [
  "Petit à petit, l'oiseau fait son nid.",
  "Il ne faut pas remettre au lendemain ce que l'on peut faire le jour même.",
  "Qui va lentement va sûrement.",
  "L'avenir appartient à ceux qui se lèvent tôt.",
  "Rien ne sert de courir, il faut partir à point.",
  "Après la pluie, le beau temps.",
  "Chaque jour suffit sa peine.",
  "Mieux vaut tard que jamais.",
  "C'est en forgeant qu'on devient forgeron.",
  "Vouloir, c'est pouvoir.",
  "Un tiens vaut mieux que deux tu l'auras.",
  "Il n'y a pas de sot métier.",
  "Qui ne risque rien n'a rien.",
  "Les petits ruisseaux font les grandes rivières.",
  "À cœur vaillant rien d'impossible.",
  "Patience et longueur de temps font plus que force ni que rage.",
  "Le temps, c'est de l'argent.",
  "Qui sème le vent récolte la tempête.",
  "Tout vient à point à qui sait attendre.",
  "L'union fait la force.",
  "On n'est jamais si bien servi que par soi-même.",
  "Il faut battre le fer pendant qu'il est chaud.",
  "La nuit porte conseil.",
  "Aide-toi, le ciel t'aidera.",
  "Paris ne s'est pas fait en un jour.",
  "Ce qui est fait n'est plus à faire.",
  "Qui veut voyager loin ménage sa monture.",
  "Le temps perdu ne se rattrape jamais.",
  "Pierre qui roule n'amasse pas mousse.",
  "Il vaut mieux prévenir que guérir.",
  "Chose promise, chose due.",
];

/** Traditional English proverbs (public domain). */
const QUOTES_EN = [
  "Little by little, the bird builds its nest.",
  "Never put off till tomorrow what you can do today.",
  "Slow and steady wins the race.",
  "The early bird catches the worm.",
  "Every cloud has a silver lining.",
  "Better late than never.",
  "Practice makes perfect.",
  "Where there's a will, there's a way.",
  "A bird in the hand is worth two in the bush.",
  "Nothing ventured, nothing gained.",
  "Many a little makes a mickle.",
  "Fortune favours the bold.",
  "Rome wasn't built in a day.",
  "Strike while the iron is hot.",
  "Sleep on it.",
  "God helps those who help themselves.",
  "Time is money.",
  "Well begun is half done.",
  "All good things come to those who wait.",
  "United we stand, divided we fall.",
  "If you want something done right, do it yourself.",
  "A rolling stone gathers no moss.",
  "An ounce of prevention is worth a pound of cure.",
  "A promise made is a debt unpaid.",
  "Lost time is never found again.",
  "Actions speak louder than words.",
  "Many hands make light work.",
  "Make hay while the sun shines.",
  "A journey of a thousand miles begins with a single step.",
  "Look before you leap.",
  "Tomorrow is another day.",
  "Variety is the spice of life.",
];

const QUOTES: Record<Language, string[]> = { fr: QUOTES_FR, en: QUOTES_EN };

export function quoteOfTheDay(localDate: string, language: Language = "fr"): string {
  const quotes = QUOTES[language];
  const [year, month, day] = localDate.split("-").map(Number);
  const dayOfYear = Math.floor((Date.UTC(year, month - 1, day) - Date.UTC(year, 0, 0)) / 86_400_000);
  return quotes[(dayOfYear + year) % quotes.length];
}
