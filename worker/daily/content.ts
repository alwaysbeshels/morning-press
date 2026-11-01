import type { Language } from "../../shared/types";

export type Bilingual = Record<Language, string>;
export interface DailyFact { text: string; source: string; url: string }
export interface DailyExercise { home: string; outdoors: string }

export function dailyIndex(localDate: string): number {
  return Math.floor(Date.parse(`${localDate}T12:00:00Z`) / 86_400_000);
}

const venus = "https://science.nasa.gov/venus/venus-facts/";
const saturn = "https://science.nasa.gov/saturn/facts/";
const water = "https://www.usgs.gov/water-science-school/science/how-much-water-there-earth";
const ocean = "https://oceanservice.noaa.gov/facts/oceanblue.html";

const FACTS: { text: Bilingual; source: string; url: string }[] = [
  { text: { fr: "Vénus met environ 243 jours terrestres à tourner sur elle-même, mais seulement 225 jours à faire le tour du Soleil.", en: "Venus takes about 243 Earth days to rotate once, but only 225 days to orbit the Sun." }, source: "NASA", url: venus },
  { text: { fr: "L'eau couvre environ 71 % de la surface terrestre. Les océans contiennent près de 96,5 % de toute l'eau de la planète.", en: "Water covers about 71% of Earth's surface. The oceans hold nearly 96.5% of all the planet's water." }, source: "USGS", url: water },
  { text: { fr: "La densité moyenne de Saturne est inférieure à celle de l'eau : une particularité unique parmi les planètes du Système solaire.", en: "Saturn's average density is lower than water's, a unique feature among the planets of our solar system." }, source: "NASA", url: saturn },
  { text: { fr: "L'océan n'est pas bleu uniquement à cause du ciel : l'eau absorbe davantage la lumière rouge et laisse mieux passer le bleu.", en: "The ocean is not blue just because of the sky: water absorbs more red light and lets blue light travel farther." }, source: "NOAA", url: ocean },
  { text: { fr: "Malgré sa distance au Soleil, Vénus est plus chaude que Mercure. Son atmosphère épaisse retient énormément de chaleur.", en: "Despite being farther from the Sun, Venus is hotter than Mercury. Its thick atmosphere traps enormous amounts of heat." }, source: "NASA", url: venus },
  { text: { fr: "Plus des deux tiers de l'eau douce terrestre sont enfermés dans la glace et les glaciers, plutôt que dans les lacs et les rivières.", en: "More than two-thirds of Earth's freshwater is locked in ice and glaciers, rather than lakes and rivers." }, source: "USGS", url: water },
  { text: { fr: "Les anneaux de Saturne sont faits d'innombrables morceaux de glace et de roche, allant de minuscules grains à des blocs énormes.", en: "Saturn's rings consist of countless pieces of ice and rock, ranging from tiny grains to enormous blocks." }, source: "NASA", url: saturn },
  { text: { fr: "La lumière du Soleil met environ huit minutes à nous parvenir, mais près de 80 minutes à atteindre Saturne.", en: "Sunlight takes about eight minutes to reach us, but nearly 80 minutes to reach Saturn." }, source: "NASA", url: saturn },
  { text: { fr: "Vénus présente des phases comme la Lune. Galilée les a observées au télescope, un indice majeur en faveur du modèle héliocentrique.", en: "Venus has phases like the Moon. Galileo observed them through a telescope, providing important evidence for the heliocentric model." }, source: "NASA", url: venus },
  { text: { fr: "L'eau douce stockée sous terre est bien plus abondante que celle des rivières et des lacs réunis.", en: "Far more freshwater is stored underground than in rivers and lakes combined." }, source: "USGS", url: water },
  { text: { fr: "Saturne tourne sur elle-même en environ 10,7 heures, mais une année saturnienne dure près de 29,4 années terrestres.", en: "Saturn rotates once in about 10.7 hours, but a Saturnian year lasts nearly 29.4 Earth years." }, source: "NASA", url: saturn },
  { text: { fr: "L'océan peut aussi paraître vert ou rouge : des particules et des sédiments en suspension modifient la lumière qui nous revient.", en: "The ocean can also look green or red: suspended particles and sediments change the light reflected back to us." }, source: "NOAA", url: ocean },
];

const EXERCISES: { home: Bilingual; outdoors: Bilingual }[] = [
  {
    home: { fr: "Marchez tranquillement sur place pendant 2 minutes. Faites une pause, puis répétez une fois si c'est confortable.", en: "Walk gently in place for 2 minutes. Take a break, then repeat once if comfortable." },
    outdoors: { fr: "Ou faites une promenade de 5 à 10 minutes, à votre rythme, si les conditions le permettent.", en: "Or take a 5–10 minute walk at your own pace, conditions permitting." },
  },
  {
    home: { fr: "Assis confortablement, faites 5 petits cercles d'épaules vers l'arrière, puis bougez doucement les chevilles pendant 30 secondes.", en: "Sitting comfortably, make 5 small backward shoulder circles, then gently move your ankles for 30 seconds." },
    outdoors: { fr: "Ou marchez environ 500 mètres sur un trajet facile, avec des pauses au besoin.", en: "Or walk about 500 metres on an easy route, taking breaks as needed." },
  },
  {
    home: { fr: "Prenez une pause active : marchez doucement dans la maison pendant 3 minutes et relâchez les épaules.", en: "Take an active break: walk gently around your home for 3 minutes and relax your shoulders." },
    outdoors: { fr: "Ou faites deux petites promenades de 5 minutes, à des moments différents de la journée.", en: "Or take two short 5-minute walks at different times of day." },
  },
  {
    home: { fr: "Assis, le dos confortable, soulevez doucement les talons 8 fois en gardant les orteils au sol. Faites une pause avant de répéter.", en: "Sitting comfortably, gently lift your heels 8 times while keeping your toes on the floor. Rest before repeating." },
    outdoors: { fr: "Ou visez une promenade tranquille de 8 minutes sur un terrain plat et sûr.", en: "Or try an easy 8-minute walk on flat, safe ground." },
  },
];

export function factOfTheDay(date: string, language: Language): DailyFact {
  const fact = FACTS[dailyIndex(date) % FACTS.length];
  return { ...fact, text: fact.text[language] };
}

export function exerciseOfTheDay(date: string, language: Language): DailyExercise {
  const exercise = EXERCISES[dailyIndex(date) % EXERCISES.length];
  return { home: exercise.home[language], outdoors: exercise.outdoors[language] };
}
