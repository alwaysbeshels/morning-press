import { describe, expect, it } from "vitest";
import { DEFAULT_COOKING, FOOD_RESTRICTIONS, MEAL_TYPES, PROTEIN_CHOICES, type FoodRestriction } from "../../shared/types";
import { compatibleRecipes, recipeOfTheDay, RECIPES } from "./recipes";
import { dailyIndex, exerciseOfTheDay, factOfTheDay } from "./content";

const enabled = { ...DEFAULT_COOKING, enabled: true };
describe("catalogue intégré", () => {
  it("désactive cuisine et exercices par défaut et garde une rotation stable", () => {
    expect(recipeOfTheDay("2026-11-01", "fr", DEFAULT_COOKING)).toBeNull();
    expect(dailyIndex("2026-11-02") - dailyIndex("2026-11-01")).toBe(1);
    expect(recipeOfTheDay("2026-11-01", "fr", enabled)?.id).toBe(recipeOfTheDay("2026-11-01", "en", enabled)?.id);
    expect(recipeOfTheDay("2026-11-02", "fr", enabled)?.id).not.toBe(recipeOfTheDay("2026-11-01", "fr", enabled)?.id);
  });
  it.each(PROTEIN_CHOICES)("a une recette pour la protéine %s", (protein) => {
    const choices = compatibleRecipes({ ...enabled, proteins: [protein] });
    expect(choices.length).toBeGreaterThan(0);
    expect(choices.every((recipe) => recipe.protein === protein)).toBe(true);
  });
  it.each(MEAL_TYPES)("respecte le repas %s et les choix multiples", (meal) => {
    const choices = compatibleRecipes({ ...enabled, meals: [meal] });
    expect(choices.length).toBeGreaterThan(0);
    expect(choices.every((recipe) => recipe.meals.includes(meal))).toBe(true);
  });
  it.each([
    ["gluten", "turkey-pasta"], ["dairy", "yogurt-berries"], ["eggs", "eggs-spinach"], ["peanuts", "oatmeal-banana"],
    ["tree_nuts", "oatmeal-apple"], ["soy", "tofu-rice"], ["fish", "salmon-rice"], ["shellfish", "shrimp-rice"],
  ] as [FoodRestriction, string][])("exclut %s sans modifier les critères", (restriction, recipeId) => {
    const preferences = { ...enabled, restrictions: [restriction] };
    const before = structuredClone(preferences);
    expect(compatibleRecipes(preferences).some((recipe) => recipe.id === recipeId)).toBe(false);
    expect(preferences).toEqual(before);
  });
  it("applique le régime le plus strict, sans produits animaux cachés", () => {
    expect(compatibleRecipes({ ...enabled, vegetarian: true }).every((recipe) =>
      ["legumes", "tofu", "nuts", "eggs", "dairy"].includes(recipe.protein))).toBe(true);
    const vegan = compatibleRecipes({ ...enabled, vegan: true, vegetarian: true });
    expect(vegan.length).toBeGreaterThan(0);
    const animalIngredients = new Set(["chicken", "beef", "fish", "pork", "turkey", "shrimp", "eggs", "yogurt", "cheese"]);
    expect(vegan.every((recipe) => recipe.ingredients.every(([key]) => !animalIngredients.has(key)))).toBe(true);
  });
  it("ne relâche jamais une restriction ni un filtre sans résultat", () => {
    expect(recipeOfTheDay("2026-11-01", "fr", { ...enabled, proteins: ["tofu"], restrictions: ["soy"] })).toBeNull();
    expect(recipeOfTheDay("2026-11-01", "fr", { ...enabled, proteins: ["chicken"], meals: ["breakfast"] })).toBeNull();
    expect(compatibleRecipes({ ...enabled, vegan: true, restrictions: [...FOOD_RESTRICTIONS] }).length).toBeGreaterThan(0);
  });
  it("fournit des recettes complètes bilingues et une vraie image embarquée quand disponible", () => {
    for (let day = 1; day <= RECIPES.length; day++) {
      for (const language of ["fr", "en"] as const) {
        const recipe = recipeOfTheDay(`2026-11-${String(day).padStart(2, "0")}`, language, enabled)!;
        expect(recipe.servings).toBe(2);
        expect(recipe.ingredients.length).toBeGreaterThanOrEqual(3);
        expect(recipe.steps.length).toBeGreaterThanOrEqual(2);
        expect(recipe.title).not.toContain("undefined");
      }
    }
    const preferences = { ...enabled, meals: ["breakfast" as const], proteins: ["nuts" as const] };
    const photo = recipeOfTheDay("2026-11-01", "fr", preferences)!.photo!;
    expect(photo.data).toMatch(/^data:image\/jpeg;base64,/);
    expect(photo.credit).toBe("Bill Ebbesen");
    expect(recipeOfTheDay("2026-11-01", "fr", { ...preferences, showPhoto: false })!.photo).toBeNull();
  });
  it("affiche un fait sourcé et deux choix d'activité, dans la bonne langue", () => {
    for (const language of ["fr", "en"] as const) {
      const fact = factOfTheDay("2026-11-01", language);
      expect(fact.url).toMatch(/^https:\/\//);
      expect(fact.source.length).toBeGreaterThan(0);
      expect(exerciseOfTheDay("2026-11-01", language).home.length).toBeGreaterThan(30);
      expect(exerciseOfTheDay("2026-11-01", language).outdoors.length).toBeGreaterThan(30);
    }
    expect(factOfTheDay("2026-11-01", "fr").text).not.toBe(factOfTheDay("2026-11-01", "en").text);
  });
});
