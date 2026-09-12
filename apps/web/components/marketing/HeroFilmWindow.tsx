'use client';

import { useEffect, useRef, useState } from 'react';
import styles from './HeroFilmWindow.module.css';

const chapters = ['Your day, already organized', 'Every model, one conversation', 'A second perspective, side by side'];
const paths = {
  Chat: 'M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z',
  Dashboard: 'M3 3h7v7H3zM14 3h7v7h-7zM3 14h7v7H3zM14 14h7v7h-7z',
  Projects: 'M22 19a2 2 0 01-2 2H4a2 2 0 01-2-2V5a2 2 0 012-2h5l2 3h9a2 2 0 012 2z',
  Goals: 'M4 21V3h14l-3 5 3 5H4',
  Reminders: 'M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01',
  Capabilities: 'M10 13a5 5 0 007.54.54l3-3a5 5 0 00-7.07-7.07l-1.72 1.71M14 11a5 5 0 00-7.54-.54l-3 3a5 5 0 007.07 7.07l1.71-1.71',
  Settings: 'M12 2a10 10 0 110 20A10 10 0 0112 2zm0 5v5l3 3',
};

function Icon({ name }: { name: keyof typeof paths }) {
  return <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"><path d={paths[name]} /></svg>;
}

/** A local product demo. It never sends prompts or loads account data. */
export default function HeroFilmWindow({ className = '' }: { className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const [chapter, setChapter] = useState(0);
  const [paused, setPaused] = useState(false);
  const [reduced, setReduced] = useState(true);
  const [visible, setVisible] = useState(false);
  const [tabVisible, setTabVisible] = useState(true);

  useEffect(() => {
    const media = matchMedia('(prefers-reduced-motion: reduce)');
    const sync = () => setReduced(media.matches || document.documentElement.hasAttribute('data-reduce-motion'));
    sync();
    media.addEventListener('change', sync);
    const prefs = new MutationObserver(sync);
    prefs.observe(document.documentElement, { attributes: true, attributeFilter: ['data-reduce-motion'] });
    const observer = new IntersectionObserver(([entry]) => setVisible(entry.isIntersecting), { threshold: 0.15 });
    if (ref.current) observer.observe(ref.current);
    const visibility = () => setTabVisible(!document.hidden);
    visibility();
    document.addEventListener('visibilitychange', visibility);
    return () => {
      media.removeEventListener('change', sync);
      prefs.disconnect();
      observer.disconnect();
      document.removeEventListener('visibilitychange', visibility);
    };
  }, []);

  const playing = !paused && !reduced && visible && tabVisible;
  useEffect(() => {
    if (!playing) return;
    const timer = setInterval(() => setChapter(value => (value + 1) % chapters.length), 7000);
    return () => clearInterval(timer);
  }, [playing, chapter]);

  return (
    <div ref={ref} className={`${styles.film} ${className}`} data-playing={playing} data-reduced={reduced}>
      <div className={styles.window} aria-label="Modus product preview with example data">
        <aside className={styles.sidebar} aria-hidden="true">
          <div className={styles.logo}>Modus<span>pilot</span></div>
          <div className={styles.search}>Ask Modus <span>⌘ K</span></div>
          {(['Chat', 'Dashboard', 'Projects', 'Goals', 'Reminders', 'Capabilities', 'Settings'] as const).map(name => (
            <div key={name}>
              {name === 'Goals' && <div className={styles.group}>Workspace</div>}
              {name === 'Capabilities' && <div className={styles.divider} />}
              <div className={`${styles.nav} ${(chapter === 0 ? name === 'Dashboard' : name === 'Chat') ? styles.active : ''}`}><Icon name={name} /><span>{name}</span></div>
            </div>
          ))}
          <div className={styles.account}><span>J</span><div>Jamie<small>Account</small></div></div>
        </aside>
        <div className={styles.main}>
          <div className={styles.topbar}><span>{chapter === 0 ? 'Dashboard' : 'Launch week plan'}</span><span className={styles.demo}>Product demo</span></div>
          <div key={chapter} className={styles.scene}>
            {chapter === 0 ? <>
              <div className={styles.greeting}>Good morning, <span>Jamie</span>.</div>
              <p className={styles.date}>Monday, September 14</p>
              <div className={styles.briefing}>
                <div className={styles.eyebrow}>Morning briefing</div>
                <h3>A clear start to your day.</h3>
                <p>Your launch is taking shape. Here are your priorities.</p>
                {['Review the launch email', 'Prepare for the 2:00 PM team call', 'Approve the weekly recap'].map((task, i) => <div key={task} className={styles.task}><span>{i + 1}</span>{task}<small>{['Draft ready', 'Agenda ready', 'For review'][i]}</small></div>)}
              </div>
              <div className={styles.cards}>
                <div className={styles.card}><div className={styles.eyebrow}>Goals</div><h4>Launch the new website</h4><p>4 of 6 milestones complete</p><div className={styles.meter}><span /></div></div>
                <div className={styles.card}><div className={styles.eyebrow}>Reminders</div><h4>Make room for deep work</h4><p>Today at 10:00 AM</p><span className={styles.tag}>Your next focus</span></div>
              </div>
            </> : <>
              <div className={styles.bubble}>Help me plan the launch. What should I focus on first?</div>
              <div className={styles.responseLabel}><span className={styles.spark}>M</span>Modus <span>{chapter === 1 ? 'Auto' : 'Compare models'}</span></div>
              {chapter === 1 ? <div className={styles.answer}>
                <h3>Start with the message. Then build momentum.</h3>
                <p>Give the launch one clear story and a simple next step.</p>
                <div className={styles.answerStep}><b>01</b><div><strong>Make the promise specific</strong><p>Lead with the problem your product solves.</p></div></div>
                <div className={styles.answerStep}><b>02</b><div><strong>Prepare your first touchpoint</strong><p>Polish the homepage and draft the launch email.</p></div></div>
                <div className={styles.answerStep}><b>03</b><div><strong>Define a useful signal</strong><p>Track signups and learn from the first conversations.</p></div></div>
              </div> : <div className={styles.compare}>
                {[{ name: 'GPT', title: 'Build a focused launch', text: 'One audience. One promise. One clear call to action.', points: ['Finalize the homepage', 'Test the signup flow', 'Send the launch email'] }, { name: 'Claude', title: 'Start with your early users', text: 'Make the first experience useful before expanding reach.', points: ['Invite a small first group', 'Ask where they get stuck', 'Refine the onboarding'] }].map(model => <div className={styles.model} key={model.name}><div className={styles.modelName}><span />{model.name}</div><h4>{model.title}</h4><p>{model.text}</p>{model.points.map(point => <div className={styles.point} key={point}>{point}</div>)}</div>)}
                <p className={styles.compareNote}>Different perspectives. One place to think.</p>
              </div>}
              <div className={styles.composer}><span>+</span><span>Ask anything...</span><small>{chapter === 1 ? 'Auto' : '2 models'}</small><b>↑</b></div>
            </>}
          </div>
        </div>
      </div>
      <div className={styles.controls}>
        <div className={styles.chapters} role="group" aria-label="Product demo chapters">
          {chapters.map((label, i) => <button type="button" key={label} aria-label={label} aria-pressed={chapter === i} onClick={() => { setChapter(i); setPaused(true); }}><span className={chapter === i ? styles.selected : ''} /></button>)}
        </div>
        <p>{chapters[chapter]}</p>
        <button type="button" className={styles.pause} disabled={reduced} onClick={() => setPaused(value => !value)} aria-label={paused ? 'Play product demo' : 'Pause product demo'}>{reduced ? 'Preview' : paused ? 'Play' : 'Pause'}</button>
      </div>
    </div>
  );
}
