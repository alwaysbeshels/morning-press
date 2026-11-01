import { isProteinAllowed, type CookingPreferences, type FoodRestriction, type Language, type MealType, type ProteinChoice } from "../../shared/types";
import { dailyIndex, type Bilingual } from "./content";
import oatmealPhoto from "./oatmeal.jpg?inline";

interface Ingredient {
  name: Bilingual;
  restrictions: FoodRestriction[];
  animal: boolean;
  vegetarian: boolean;
}

function ingredient(fr: string, en: string, restrictions: FoodRestriction[] = [], animal = false, vegetarian = true): Ingredient {
  return { name: { fr, en }, restrictions, animal, vegetarian };
}

const INGREDIENTS = {
  chicken: ingredient("poulet déjà cuit, refroidi", "cooked, chilled chicken", [], true, false),
  beef: ingredient("bœuf déjà cuit, refroidi", "cooked, chilled beef", [], true, false),
  fish: ingredient("saumon déjà cuit, refroidi", "cooked, chilled salmon", ["fish"], true, false),
  pork: ingredient("porc déjà cuit, refroidi", "cooked, chilled pork", [], true, false),
  turkey: ingredient("dinde déjà cuite, refroidie", "cooked, chilled turkey", [], true, false),
  shrimp: ingredient("crevettes cuites, refroidies", "cooked, chilled shrimp", ["shellfish"], true, false),
  eggs: ingredient("œufs", "eggs", ["eggs"], true),
  yogurt: ingredient("yogourt nature", "plain yogurt", ["dairy"], true),
  cheese: ingredient("fromage râpé", "grated cheese", ["dairy"], true),
  chickpeas: ingredient("pois chiches cuits, rincés", "cooked, rinsed chickpeas"),
  lentils: ingredient("lentilles cuites, rincées", "cooked, rinsed lentils"),
  beans: ingredient("haricots blancs cuits, rincés", "cooked, rinsed white beans"),
  tofu: ingredient("tofu ferme nature", "plain firm tofu", ["soy"]),
  peanuts: ingredient("beurre d'arachide nature", "plain peanut butter", ["peanuts"]),
  almonds: ingredient("amandes non salées", "unsalted almonds", ["tree_nuts"]),
  oats: ingredient("flocons d'avoine certifiés sans gluten", "certified gluten-free rolled oats"),
  rice: ingredient("riz cuit, refroidi", "cooked, chilled rice"),
  quinoa: ingredient("quinoa cuit, refroidi", "cooked, chilled quinoa"),
  pasta: ingredient("pâtes de blé cuites, refroidies", "cooked, chilled wheat pasta", ["gluten"]),
  bread: ingredient("pain de blé entier", "whole-wheat bread", ["gluten"]),
  cucumber: ingredient("concombre", "cucumber"),
  tomatoes: ingredient("tomates", "tomatoes"),
  carrot: ingredient("carotte", "carrot"),
  pepper: ingredient("poivron", "bell pepper"),
  spinach: ingredient("jeunes épinards", "baby spinach"),
  apple: ingredient("pomme", "apple"),
  banana: ingredient("banane", "banana"),
  berries: ingredient("petits fruits", "berries"),
  lemon: ingredient("jus de citron", "lemon juice"),
  oil: ingredient("huile d'olive", "olive oil"),
  water: ingredient("eau", "water"),
  cinnamon: ingredient("cannelle moulue", "ground cinnamon"),
};

type IngredientKey = keyof typeof INGREDIENTS;
export interface RecipeDefinition {
  id: string;
  title: Bilingual;
  meals: MealType[];
  protein: ProteinChoice;
  minutes: number;
  ingredients: [IngredientKey, string | Bilingual][];
  steps: Bilingual[];
  photo?: boolean;
}

export interface DailyRecipe {
  id: string;
  title: string;
  minutes: number;
  servings: number;
  ingredients: string[];
  steps: string[];
  photo: { data: string; credit: string; url: string } | null;
}

const spoon = { fr: "1 c. à s.", en: "1 tbsp" };
const bowlSteps: Bilingual[] = [
  { fr: "Lavez et coupez les légumes en petits morceaux. Détaillez la protéine déjà cuite.", en: "Wash and chop the vegetables. Cut the already cooked protein into bite-size pieces." },
  { fr: "Mélangez tous les ingrédients avec le citron et l'huile. Servez froid; gardez au réfrigérateur jusqu'au repas.", en: "Toss all ingredients with the lemon and oil. Serve cold; refrigerate until mealtime." },
];

function bowl(id: string, title: Bilingual, protein: ProteinChoice, main: IngredientKey, grain: IngredientKey, vegetable: IngredientKey): RecipeDefinition {
  return {
    id, title, protein, meals: ["lunch", "dinner"], minutes: 10,
    ingredients: [[main, "200 g"], [grain, "300 g"], [vegetable, "200 g"], ["lemon", spoon], ["oil", spoon]],
    steps: bowlSteps,
  };
}

// Recettes originales pour deux personnes. Les filtres sont dérivés de chaque ingrédient.
export const RECIPES: RecipeDefinition[] = [
  bowl("chicken-rice", { fr: "Salade de poulet, riz et concombre", en: "Chicken, rice and cucumber salad" }, "chicken", "chicken", "rice", "cucumber"),
  bowl("beef-quinoa", { fr: "Bol de bœuf, quinoa et tomates", en: "Beef, quinoa and tomato bowl" }, "beef", "beef", "quinoa", "tomatoes"),
  bowl("salmon-rice", { fr: "Salade de saumon et riz au citron", en: "Lemon salmon and rice salad" }, "fish", "fish", "rice", "cucumber"),
  bowl("pork-quinoa", { fr: "Porc et quinoa aux poivrons", en: "Pork and quinoa with bell peppers" }, "pork", "pork", "quinoa", "pepper"),
  bowl("turkey-pasta", { fr: "Salade de dinde et petites pâtes", en: "Turkey and pasta salad" }, "turkey", "turkey", "pasta", "tomatoes"),
  bowl("turkey-rice", { fr: "Bol de dinde et riz croquant", en: "Crunchy turkey and rice bowl" }, "turkey", "turkey", "rice", "carrot"),
  bowl("shrimp-rice", { fr: "Crevettes et riz au concombre", en: "Shrimp and cucumber rice salad" }, "seafood", "shrimp", "rice", "cucumber"),
  bowl("lentil-quinoa", { fr: "Lentilles et quinoa aux tomates", en: "Lentil, quinoa and tomato salad" }, "legumes", "lentils", "quinoa", "tomatoes"),
  bowl("chickpea-rice", { fr: "Pois chiches et riz au citron", en: "Lemon chickpea and rice bowl" }, "legumes", "chickpeas", "rice", "pepper"),
  {
    id: "tofu-rice", title: { fr: "Tofu doré et riz aux épinards", en: "Golden tofu and spinach rice" },
    meals: ["lunch", "dinner"], protein: "tofu", minutes: 15,
    ingredients: [["tofu", "250 g"], ["rice", "300 g"], ["spinach", "100 g"], ["oil", spoon], ["water", "30 ml"]],
    steps: [
      { fr: "Coupez le tofu. Faites-le dorer dans l'huile à feu moyen pendant 6 à 8 minutes en le retournant.", en: "Dice the tofu. Cook in the oil over medium heat for 6–8 minutes, turning to brown the pieces." },
      { fr: "Ajoutez le riz, les épinards et l'eau. Couvrez et réchauffez en remuant jusqu'à 74 °C au centre. Servez aussitôt.", en: "Add rice, spinach and water. Cover and reheat, stirring, until the centre reaches 74°C. Serve immediately." },
    ],
  },
  {
    id: "eggs-spinach", title: { fr: "Œufs brouillés aux épinards", en: "Spinach scrambled eggs" },
    meals: ["breakfast", "lunch", "dinner"], protein: "eggs", minutes: 10,
    ingredients: [["eggs", "4"], ["spinach", "100 g"], ["tomatoes", "200 g"], ["oil", spoon]],
    steps: [
      { fr: "Lavez les légumes. Faites tomber les épinards dans l'huile 2 minutes, à feu moyen.", en: "Wash the vegetables. Wilt the spinach in the oil for 2 minutes over medium heat." },
      { fr: "Battez les œufs, versez-les et remuez jusqu'à ce qu'ils soient entièrement pris (74 °C). Servez avec les tomates coupées.", en: "Beat and add the eggs; stir until fully set (74°C). Serve with the chopped tomatoes." },
    ],
  },
  {
    id: "oatmeal-banana", title: { fr: "Gruau banane et arachide", en: "Banana peanut oatmeal" },
    meals: ["breakfast", "snack"], protein: "nuts", minutes: 10, photo: true,
    ingredients: [["oats", "80 g"], ["water", "400 ml"], ["banana", "1"], ["peanuts", "30 g"]],
    steps: [
      { fr: "Portez l'eau à ébullition. Ajoutez les flocons et laissez frémir 5 à 7 minutes en remuant.", en: "Bring the water to a boil. Add the oats and simmer for 5–7 minutes, stirring." },
      { fr: "Hors du feu, incorporez le beurre d'arachide. Répartissez dans deux bols et ajoutez la banane en rondelles.", en: "Remove from heat and stir in the peanut butter. Divide into two bowls and top with sliced banana." },
    ],
  },
  {
    id: "oatmeal-apple", title: { fr: "Gruau pomme et amandes", en: "Apple almond oatmeal" },
    meals: ["breakfast", "snack"], protein: "nuts", minutes: 12, photo: true,
    ingredients: [["oats", "80 g"], ["water", "400 ml"], ["apple", "1"], ["almonds", "30 g"], ["cinnamon", { fr: "1 pincée", en: "1 pinch" }]],
    steps: [
      { fr: "Lavez et râpez la pomme. Portez l'eau à ébullition, puis ajoutez les flocons, la pomme et la cannelle.", en: "Wash and grate the apple. Bring the water to a boil, then add the oats, apple and cinnamon." },
      { fr: "Laissez frémir 7 à 9 minutes en remuant. Répartissez dans deux bols; parsemez d'amandes hachées.", en: "Simmer for 7–9 minutes, stirring. Divide into two bowls and top with chopped almonds." },
    ],
  },
  {
    id: "yogurt-berries", title: { fr: "Yogourt aux fruits et flocons", en: "Fruit and oat yogurt bowls" },
    meals: ["breakfast", "snack"], protein: "dairy", minutes: 5,
    ingredients: [["yogurt", "300 g"], ["berries", "150 g"], ["oats", "40 g"]],
    steps: [
      { fr: "Lavez les fruits. Répartissez le yogourt dans deux bols, puis ajoutez les fruits et les flocons.", en: "Wash the fruit. Divide the yogurt into two bowls, then add the fruit and oats." },
      { fr: "Laissez les flocons ramollir quelques minutes au réfrigérateur, puis servez.", en: "Let the oats soften for a few minutes in the refrigerator, then serve." },
    ],
  },
  {
    id: "chickpea-toast", title: { fr: "Tartines de pois chiches au citron", en: "Lemon chickpea toast" },
    meals: ["breakfast", "lunch", "snack"], protein: "legumes", minutes: 10,
    ingredients: [["chickpeas", "250 g"], ["bread", { fr: "4 tranches", en: "4 slices" }], ["tomatoes", "150 g"], ["lemon", spoon], ["oil", spoon]],
    steps: [
      { fr: "Écrasez les pois chiches avec le citron et l'huile. Lavez et coupez les tomates.", en: "Mash the chickpeas with the lemon and oil. Wash and slice the tomatoes." },
      { fr: "Faites griller le pain. Tartinez de purée de pois chiches et garnissez de tomates.", en: "Toast the bread. Spread with the chickpea mash and top with tomatoes." },
    ],
  },
  {
    id: "bean-dip", title: { fr: "Trempette de haricots et crudités", en: "White bean dip with vegetables" },
    meals: ["breakfast", "lunch", "snack"], protein: "legumes", minutes: 10,
    ingredients: [["beans", "250 g"], ["carrot", "150 g"], ["cucumber", "150 g"], ["lemon", spoon], ["oil", spoon], ["water", "30 ml"]],
    steps: [
      { fr: "Écrasez finement les haricots avec le citron, l'huile et l'eau jusqu'à une texture crémeuse.", en: "Mash the beans thoroughly with the lemon, oil and water until creamy." },
      { fr: "Lavez les légumes, coupez-les en bâtonnets et servez avec la trempette. Gardez au frais.", en: "Wash the vegetables, cut into sticks and serve with the dip. Keep refrigerated." },
    ],
  },
  {
    id: "tofu-breakfast", title: { fr: "Brouillade de tofu aux tomates", en: "Tomato tofu scramble" },
    meals: ["breakfast", "lunch", "dinner"], protein: "tofu", minutes: 12,
    ingredients: [["tofu", "250 g"], ["tomatoes", "200 g"], ["spinach", "75 g"], ["oil", spoon]],
    steps: [
      { fr: "Lavez les légumes et coupez les tomates. Émiettez le tofu à la fourchette.", en: "Wash the vegetables and chop the tomatoes. Crumble the tofu with a fork." },
      { fr: "Chauffez l'huile. Faites revenir le tofu et les tomates 6 à 8 minutes en remuant; ajoutez les épinards pour les 2 dernières minutes.", en: "Heat the oil. Cook the tofu and tomatoes for 6–8 minutes, stirring; add the spinach for the last 2 minutes." },
    ],
  },
  {
    id: "cheese-tomato-toast", title: { fr: "Tartines chaudes tomate et fromage", en: "Warm tomato cheese toast" },
    meals: ["lunch", "dinner", "snack"], protein: "dairy", minutes: 12,
    ingredients: [["bread", { fr: "4 tranches", en: "4 slices" }], ["tomatoes", "200 g"], ["cheese", "100 g"]],
    steps: [
      { fr: "Préchauffez le four à 200 °C. Lavez et tranchez les tomates; posez-les sur le pain, puis ajoutez le fromage.", en: "Preheat the oven to 200°C. Wash and slice the tomatoes; arrange on the bread and top with cheese." },
      { fr: "Déposez sur une plaque et enfournez 7 à 9 minutes, jusqu'à ce que le fromage fonde. Laissez tiédir avant de servir.", en: "Place on a baking tray and bake for 7–9 minutes, until the cheese melts. Allow to cool slightly before serving." },
    ],
  },
];

export function compatibleRecipes(preferences: CookingPreferences): RecipeDefinition[] {
  return RECIPES.filter((recipe) =>
    recipe.meals.some((meal) => preferences.meals.includes(meal)) &&
    preferences.proteins.includes(recipe.protein) && isProteinAllowed(preferences, recipe.protein) &&
    recipe.ingredients.every(([key]) => {
      const item = INGREDIENTS[key];
      return !item.restrictions.some((restriction) => preferences.restrictions.includes(restriction)) &&
        (!preferences.vegetarian || item.vegetarian) && (!preferences.vegan || !item.animal);
    }),
  );
}

export function recipeOfTheDay(date: string, language: Language, preferences: CookingPreferences): DailyRecipe | null {
  if (!preferences.enabled) return null;
  const choices = compatibleRecipes(preferences);
  if (choices.length === 0) return null;
  const recipe = choices[dailyIndex(date) % choices.length];
  return {
    id: recipe.id, title: recipe.title[language], minutes: recipe.minutes, servings: 2,
    ingredients: recipe.ingredients.map(([key, quantity]) =>
      `${typeof quantity === "string" ? quantity : quantity[language]} ${INGREDIENTS[key].name[language]}`),
    steps: recipe.steps.map((step) => step[language]),
    photo: preferences.showPhoto && recipe.photo
      ? { data: oatmealPhoto, credit: "Bill Ebbesen", url: "https://commons.wikimedia.org/wiki/File:Oatmeal.jpg" } : null,
  };
}
