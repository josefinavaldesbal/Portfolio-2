// ════════════════════════════════════════════════════════
//  HOSPITAL OLVIDADO — Datos del juego
//  Edita aquí los trabajos del portafolio y los acertijos
// ════════════════════════════════════════════════════════

/**
 * TRABAJOS DEL PORTAFOLIO
 * Cada entrada se desbloquea con una llave (tras resolver el acertijo)
 * 
 * Campos:
 *  id          - identificador único
 *  room        - nombre narrativo del cuarto
 *  icon        - emoji para el HUD / modal
 *  keyColor    - color de la llave (#hex)
 *  title       - título del trabajo
 *  description - descripción del trabajo
 *  images      - array de rutas a imágenes (en assets/images/)
 *  link        - URL externa (opcional)
 *  tools       - herramientas / software usadas
 */
export const PORTFOLIO_ITEMS = [
  {
    id: 'work-1',
    room: 'Sala de Cirugía',
    icon: '🔪',
    keyColor: '#cc3333',
    title: 'Trabajo 1 — Título aquí',
    description: 'Descripción de este trabajo de diseño gráfico. Explica el proceso, el cliente, los resultados.',
    images: ['assets/images/work1.jpg'],
    link: '',
    tools: ['Illustrator', 'Photoshop'],
  },
  {
    id: 'work-2',
    room: 'Morgue',
    icon: '☠',
    keyColor: '#6633cc',
    title: 'Trabajo 2 — Título aquí',
    description: 'Descripción del segundo trabajo.',
    images: ['assets/images/work2.jpg'],
    link: '',
    tools: ['After Effects', 'Premiere'],
  },
  {
    id: 'work-3',
    room: 'Laboratorio',
    icon: '🧪',
    keyColor: '#33cc66',
    title: 'Trabajo 3 — Título aquí',
    description: 'Descripción del tercer trabajo.',
    images: ['assets/images/work3.jpg'],
    link: '',
    tools: ['Figma', 'Blender'],
  },
  {
    id: 'work-4',
    room: 'Psiquiátrico',
    icon: '🧠',
    keyColor: '#cc6633',
    title: 'Trabajo 4 — Título aquí',
    description: 'Descripción del cuarto trabajo.',
    images: ['assets/images/work4.jpg'],
    link: '',
    tools: ['Photoshop', 'InDesign'],
  },
];

/**
 * ACERTIJOS
 * Uno por trabajo. El jugador debe resolverlo para obtener la llave.
 * 
 * Tipos:
 *  'multiple'  - opciones múltiples (options: [])
 *  'text'      - respuesta de texto libre (answer: string)
 * 
 * Campos narrative: texto ambiental que aparece antes de la pregunta
 */
export const RIDDLES = [
  {
    workId: 'work-1',
    narrative: 'Encuentras un expediente ensangrentado sobre la mesa de operaciones. Una nota dice:',
    question: '¿Qué herramienta siempre usa un diseñador gráfico para trazar vectores perfectos?',
    type: 'multiple',
    options: ['Microsoft Word', 'Adobe Illustrator', 'Excel', 'Notepad'],
    answer: 'Adobe Illustrator',
    wrongMsg: 'Las luces parpadean… respuesta incorrecta.',
    correctMsg: '🗝 La cerradura cede. Escuchas un click metálico.',
  },
  {
    workId: 'work-2',
    narrative: 'En la morgue hay un espejo roto. En los fragmentos puedes leer al revés:',
    question: '¿Cuántos fotogramas por segundo tiene el video estándar de cine (fps)?',
    type: 'multiple',
    options: ['12 fps', '30 fps', '24 fps', '60 fps'],
    answer: '24 fps',
    wrongMsg: 'Un frío extraño recorre tu columna…',
    correctMsg: '🗝 La gaveta se abre con un chirrido.',
  },
  {
    workId: 'work-3',
    narrative: 'Sobre la pizarra del laboratorio alguien escribió con sangre:',
    question: '¿Qué significan las siglas "UI" en diseño digital?',
    type: 'multiple',
    options: ['Unlimited Interface', 'User Interface', 'Unique Interaction', 'Universal Input'],
    answer: 'User Interface',
    wrongMsg: 'El microscopio cae al suelo…',
    correctMsg: '🗝 El tubo de ensayo contiene una pequeña llave.',
  },
  {
    workId: 'work-4',
    narrative: 'Las paredes acolchadas tienen inscripciones. Una repite sin parar:',
    question: '¿Cuál es el modo de color usado para pantallas digitales?',
    type: 'multiple',
    options: ['CMYK', 'RGB', 'HSL', 'PMS'],
    answer: 'RGB',
    wrongMsg: 'Algo se mueve detrás de ti…',
    correctMsg: '🗝 La camisa de fuerza suelta una llave oxidada.',
  },
];

/**
 * PUNTOS INTERACTIVOS — 4 cajas en las habitaciones seleccionadas
 * Coordenadas exactas obtenidas in-game:
 */
export const INTERACTION_POINTS = [
  {
    workId: 'work-1',
    position: { x: -10.16, y: 8.15, z: 15.43 },
    radius: 3.5,
    label: 'Sala de Cirugía',
    model: 'assets/models/old_abandoned_hospital_bed.glb',
    targetSize: 2.2,
  },
  {
    workId: 'work-2',
    position: { x:  27.09, y: 2.55, z: -3.88 },
    radius: 3.5,
    label: 'Morgue',
    model: 'assets/models/dirty_water_closet.glb',
    targetSize: 1.6,
  },
  {
    workId: 'work-3',
    position: { x: -19.69, y: 7.65, z:  2.09 },
    radius: 3.5,
    label: 'Laboratorio',
    model: 'assets/models/abandoned_antique_recliner_lounge.glb',
    targetSize: 2.2,
  },
  {
    workId: 'work-4',
    position: { x:  21.12, y: 8.14, z:  2.68 },
    radius: 3.5,
    label: 'Psiquiátrico',
    model: 'assets/models/ruined_green_chair.glb',
    targetSize: 1.5,
  },
];



