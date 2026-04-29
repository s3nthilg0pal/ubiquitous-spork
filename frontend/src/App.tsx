import { useEffect, useState } from 'react';
import { Tabs, TabList, Tab, TabPanel } from 'react-aria-components';
import { api, type PlanResponse } from './api';
import TodayView from './components/TodayView';
import WeekView from './components/WeekView';
import ShoppingView from './components/ShoppingView';

export default function App() {
  const [plan, setPlan] = useState<PlanResponse | null>(null);
  const [currentDayIndex, setCurrentDayIndex] = useState(0);
  const [activeTab, setActiveTab] = useState<string>('today');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api.getPlan().then(setPlan).catch(e => setError(String(e)));
  }, []);

  const goToDay = (idx: number) => {
    setCurrentDayIndex(idx);
    setActiveTab('today');
  };

  return (
    <div className="app">
      <header className="app-header">
        <h1>Purge LDL</h1>
        <p className="subtitle">7-day heart-healthy meal plan</p>
      </header>

      {error && <div className="error">Failed to load: {error}</div>}

      {plan && (
        <Tabs
          selectedKey={activeTab}
          onSelectionChange={(k) => setActiveTab(String(k))}
          className="tabs-root"
        >
          <TabList aria-label="Sections" className="tabs">
            <Tab id="today" className="tab">Today</Tab>
            <Tab id="week" className="tab">Week</Tab>
            <Tab id="shopping" className="tab">Shopping</Tab>
          </TabList>

          <TabPanel id="today" className="view">
            <TodayView
              plan={plan}
              currentDayIndex={currentDayIndex}
              onChangeDay={setCurrentDayIndex}
            />
          </TabPanel>
          <TabPanel id="week" className="view">
            <WeekView
              plan={plan}
              currentDayIndex={currentDayIndex}
              onSelectDay={goToDay}
            />
          </TabPanel>
          <TabPanel id="shopping" className="view">
            <ShoppingView />
          </TabPanel>
        </Tabs>
      )}

      {!plan && !error && <div className="loading">Loading…</div>}
    </div>
  );
}
