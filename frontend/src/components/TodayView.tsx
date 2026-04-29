import { useState } from 'react';
import { Button } from 'react-aria-components';
import type { Meal, PlanResponse } from '../api';
import { dateForDay, formatDate } from '../dates';
import RecipeModal from './RecipeModal';

interface Props {
  plan: PlanResponse;
  currentDayIndex: number;
  onChangeDay: (idx: number) => void;
}

export default function TodayView({ plan, currentDayIndex, onChangeDay }: Props) {
  const [openMeal, setOpenMeal] = useState<Meal | null>(null);

  const day = plan.days[currentDayIndex];
  const date = dateForDay(plan.startDate, currentDayIndex);

  const prev = () => onChangeDay((currentDayIndex - 1 + plan.days.length) % plan.days.length);
  const next = () => onChangeDay((currentDayIndex + 1) % plan.days.length);

  const renderMealCard = (label: string, meal: Meal) => (
    <div className="meal-card" key={label}>
      <div className="meal-type">{label}</div>
      <div className="meal-name">{meal.name}</div>
      <Button className="view-recipe" onPress={() => setOpenMeal(meal)}>
        View recipe
      </Button>
    </div>
  );

  return (
    <>
      <div className="day-nav">
        <Button onPress={prev} aria-label="Previous day" className="day-nav-btn">‹</Button>
        <div className="day-info">
          <div className="day-label">Day {day.day}</div>
          <div className="day-date">{formatDate(date)}</div>
        </div>
        <Button onPress={next} aria-label="Next day" className="day-nav-btn">›</Button>
      </div>

      <div className="meals">
        {renderMealCard('Breakfast', day.meals.breakfast)}
        {renderMealCard('Lunch', day.meals.lunch)}
        {renderMealCard('Dinner', day.meals.dinner)}
        <div className="meal-card">
          <div className="meal-type">Snack</div>
          <p className="snack-text">{day.meals.snack}</p>
        </div>
      </div>

      <RecipeModal meal={openMeal} onClose={() => setOpenMeal(null)} />
    </>
  );
}
