/* Exercise library — static HD SVGs with light SMIL motion. Authored locally, not model output. */
const EXERCISES = [
  {
    id: "ex1",
    title: "Brustmuskel- & Schulteröffner (Pec Stretch)",
    duration: "45 Sek. je Seite",
    target: "Brustmuskeln (Pectoralis Major/Minor), vordere Schulter",
    instructions: "Arm im 90°-Winkel an einen Türrahmen anlegen. Den Oberkörper sanft nach vorne drehen, bis ein Zug in der Brust spürbar ist. Nicht in den Schmerz gehen.",
    svg: `<svg viewBox="0 0 200 200" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <rect width="200" height="200" fill="#111827" rx="12"/>
      <line x1="40" y1="20" x2="40" y2="180" stroke="#374151" stroke-width="8" stroke-linecap="round"/>
      <g>
        <animateTransform attributeName="transform" type="rotate" values="-4 100 75; 5 100 75; -4 100 75" dur="3.2s" repeatCount="indefinite"/>
        <circle cx="100" cy="50" r="14" fill="#9ca3af"/>
        <path d="M100 65 L100 120" stroke="#9ca3af" stroke-width="6" stroke-linecap="round"/>
        <path d="M100 75 Q75 75 40 70" stroke="#10b981" stroke-width="8" stroke-linecap="round"/>
        <circle cx="40" cy="70" r="5" fill="#10b981"/>
        <path d="M100 75 Q125 80 140 100" stroke="#6b7280" stroke-width="5" stroke-linecap="round"/>
        <path d="M100 120 L85 170" stroke="#9ca3af" stroke-width="6" stroke-linecap="round"/>
        <path d="M100 120 L120 170" stroke="#9ca3af" stroke-width="6" stroke-linecap="round"/>
        <path d="M110 90 Q130 90 125 105" fill="none" stroke="#34d399" stroke-width="2" stroke-dasharray="3 3"/>
      </g>
    </svg>`
  },
  {
    id: "ex2",
    title: "Nackendehnung & Trapezius-Release",
    duration: "30–40 Sek. je Seite",
    target: "Musculus Trapezius (oberer Anteil), Levator Scapulae",
    instructions: "Kopf sanft zur rechten Schulter neigen. Die linke Schulter aktiv nach unten ziehen, um den Nackenraum zu weiten. Kein Zug am Kopf.",
    svg: `<svg viewBox="0 0 200 200" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <rect width="200" height="200" fill="#111827" rx="12"/>
      <g>
        <animateTransform attributeName="transform" type="rotate" values="0 100 70; 10 100 70; 0 100 70" dur="3.6s" repeatCount="indefinite"/>
        <circle cx="115" cy="45" r="14" fill="#9ca3af"/>
        <path d="M100 60 Q105 75 100 125" stroke="#9ca3af" stroke-width="6" stroke-linecap="round"/>
        <path d="M95 55 Q75 70 65 95" stroke="#10b981" stroke-width="7" stroke-linecap="round"/>
        <path d="M110 65 Q135 75 140 105" stroke="#6b7280" stroke-width="5" stroke-linecap="round"/>
      </g>
      <line x1="65" y1="95" x2="65" y2="140" stroke="#6b7280" stroke-width="5" stroke-linecap="round"/>
      <line x1="140" y1="105" x2="140" y2="140" stroke="#6b7280" stroke-width="5" stroke-linecap="round"/>
    </svg>`
  },
  {
    id: "ex3",
    title: "Hüftbeuger-Dehnung (kniender Ausfallschritt)",
    duration: "45–60 Sek. je Seite",
    target: "Musculus Iliopsoas, Rectus Femoris",
    instructions: "In den Ausfallschritt gehen, hinteres Knie ablegen. Das Becken nach vorne-unten schieben und den Rumpf aufrecht halten.",
    svg: `<svg viewBox="0 0 200 200" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <rect width="200" height="200" fill="#111827" rx="12"/>
      <line x1="15" y1="165" x2="185" y2="165" stroke="#374151" stroke-width="4"/>
      <g>
        <animateTransform attributeName="transform" type="translate" values="0 0; 4 2; 0 0" dur="2.8s" repeatCount="indefinite"/>
        <circle cx="85" cy="45" r="14" fill="#9ca3af"/>
        <line x1="85" y1="60" x2="85" y2="110" stroke="#9ca3af" stroke-width="6" stroke-linecap="round"/>
        <polyline points="85,110 130,110 130,165" fill="none" stroke="#9ca3af" stroke-width="6" stroke-linecap="round"/>
        <polyline points="85,110 50,135 25,165" fill="none" stroke="#6b7280" stroke-width="5" stroke-linecap="round"/>
        <path d="M85 105 Q70 120 60 135" stroke="#10b981" stroke-width="8" stroke-linecap="round"/>
      </g>
    </svg>`
  },
  {
    id: "ex4",
    title: "Chin Tucks (Kopf zurück zur Wandlinie)",
    duration: "8–10 Wiederholungen",
    target: "Tiefe Nackenbeuger, gegen vorgeneigten Kopf",
    instructions: "Kiefer leicht einziehen, Hinterkopf nach hinten gleiten lassen, als würde eine doppeltes Kinn entstehen. 3 Sekunden halten, dann lockerlassen. Schultern bleiben unten.",
    svg: `<svg viewBox="0 0 200 200" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <rect width="200" height="200" fill="#111827" rx="12"/>
      <line x1="148" y1="20" x2="148" y2="180" stroke="#374151" stroke-width="6" stroke-linecap="round"/>
      <g>
        <animateTransform attributeName="transform" type="translate" values="0 0; 8 0; 0 0" dur="2.4s" repeatCount="indefinite"/>
        <circle cx="108" cy="52" r="14" fill="#9ca3af"/>
        <path d="M108 66 L108 128" stroke="#9ca3af" stroke-width="6" stroke-linecap="round"/>
        <path d="M108 80 L78 112" stroke="#6b7280" stroke-width="5" stroke-linecap="round"/>
        <path d="M108 80 L132 100" stroke="#6b7280" stroke-width="5" stroke-linecap="round"/>
        <path d="M122 58 Q138 58 142 70" fill="none" stroke="#10b981" stroke-width="3" stroke-linecap="round"/>
      </g>
    </svg>`
  },
  {
    id: "ex5",
    title: "Wall Angels (Schulterblätter an der Wand)",
    duration: "8 langsame Wiederholungen",
    target: "untere Trapezmuskeln, hintere Schulter, Brustöffnung",
    instructions: "Rücken und Hinterkopf an die Wand. Arme in W-Form. Langsam nach oben gleiten, ohne den unteren Rücken abzuheben. Wenn die Arme die Wand verlieren, den Weg verkürzen.",
    svg: `<svg viewBox="0 0 200 200" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <rect width="200" height="200" fill="#111827" rx="12"/>
      <line x1="100" y1="18" x2="100" y2="182" stroke="#374151" stroke-width="6"/>
      <circle cx="100" cy="44" r="13" fill="#9ca3af"/>
      <path d="M100 57 L100 130" stroke="#9ca3af" stroke-width="6" stroke-linecap="round"/>
      <path d="M100 130 L82 178" stroke="#9ca3af" stroke-width="6" stroke-linecap="round"/>
      <path d="M100 130 L118 178" stroke="#9ca3af" stroke-width="6" stroke-linecap="round"/>
      <g>
        <path d="M100 78 L62 92 L54 58" fill="none" stroke="#10b981" stroke-width="6" stroke-linecap="round">
          <animate attributeName="d" values="M100 78 L62 92 L54 58; M100 78 L58 70 L52 38; M100 78 L62 92 L54 58" dur="3s" repeatCount="indefinite"/>
        </path>
        <path d="M100 78 L138 92 L146 58" fill="none" stroke="#10b981" stroke-width="6" stroke-linecap="round">
          <animate attributeName="d" values="M100 78 L138 92 L146 58; M100 78 L142 70 L148 38; M100 78 L138 92 L146 58" dur="3s" repeatCount="indefinite"/>
        </path>
      </g>
    </svg>`
  }
];

const GEMINI_URL = "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent";
const STORAGE_KEY_API = "health_gemini_api_key";
const STORAGE_KEY_PROFILE = "health_user_profile";
const STORAGE_IMPULSES = "health_day_impulses";
