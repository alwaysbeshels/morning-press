import type { Language } from "../../shared/types";
import { FACTS } from "./facts";

export type Bilingual = Record<Language, string>;
export interface DailyFact { text: string; source: string; url: string }
export interface DailyExercise { home: string; outdoors: string }

export function dailyIndex(localDate: string): number {
  return Math.floor(Date.parse(`${localDate}T12:00:00Z`) / 86_400_000);
}

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
