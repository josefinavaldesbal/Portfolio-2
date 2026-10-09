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
    title: 'Fabricación de prototipos | Equipamiento de montaña',
    description: 'Proyecto de desarrollo de producto enfocado en la exploración y aplicación de distintos métodos de fabricación para la industria del equipamiento de montaña. A través de la construcción de un piolet, se integraron tecnologías como la impresión 3D con estructuras lattice, el corte de metal mediante Waterjet y la confección de una amarra textil mediante máquina de coser. El proyecto permitió experimentar con distintos materiales y procesos productivos, explorando su integración en un producto que combina componentes estructurales, geometrías complejas y elementos textiles.',
    images: ['assets/images/proyecto_3_piolet.jpg'],
    link: '',
    tools: ['Autodesk Fusion 360', 'Rhinoceros 7', 'Twinmotion', 'Plataformas de impresión 3D', 'Waterjet'],
  },
  {
    id: 'work-2',
    room: 'Morgue',
    icon: '☠',
    keyColor: '#6633cc',
    title: 'Experimentación en madera laminada | Diseño de mobiliario',
    description: 'Proyecto de investigación y experimentación material enfocado en explorar las posibilidades estructurales y formales de la madera laminada a través de un proceso de estudio, iteración y desarrollo de prototipos. El resultado fue una silla de estructura trenzada, liviana y autoportante, que aprovecha las propiedades del material para generar una configuración resistente y visualmente dinámica. La propuesta busca desafiar las concepciones tradicionales sobre el uso de la madera, explorando nuevas formas de construcción y demostrando su versatilidad para desarrollar piezas de mobiliario que equilibran ligereza, funcionalidad y expresión formal.',
    images: ['assets/images/proyecto_2_madera.jpg'],
    link: '',
    tools: ['Madera laminada', 'Estudio de iteración y prototipos', 'Diseño de mobiliario'],
  },
  {
    id: 'work-3',
    room: 'Laboratorio',
    icon: '🧪',
    keyColor: '#33cc66',
    title: 'Diseño paramétrico | Modelación con Grasshopper',
    description: 'Proyecto de exploración del diseño computacional orientado al aprendizaje de Grasshopper y sus posibilidades para el desarrollo de geometrías complejas mediante modelación paramétrica. A partir del estudio y la reinterpretación del pabellón de investigación ICD/ITKE 2014-15 de la Universidad de Stuttgart, se buscó comprender la relación entre geometría, estructura y lógica constructiva, replicando sus principios formales mediante la programación visual. El ejercicio permitió experimentar con la parametrización como herramienta de diseño, explorando cómo la definición de variables y relaciones geométricas facilita la generación, modificación y optimización de estructuras.',
    images: ['assets/images/proyecto_4_grasshopper.png'],
    link: '',
    tools: ['Rhinoceros 7', 'Grasshopper', 'Twinmotion'],
  },
  {
    id: 'work-4',
    room: 'Psiquiátrico',
    icon: '🧠',
    keyColor: '#cc6633',
    title: 'Diseño arquitectónico | Vivienda en el paisaje',
    description: 'Proyecto de exploración arquitectónica enfocado en el diseño de una vivienda a partir del análisis del territorio, su topografía y las necesidades de un usuario específico. Ubicado en una quebrada de la cordillera de la Región del Maule, el proyecto propone una estructura habitable suspendida que conecta ambos extremos del relieve, configurándose como una casa-puente anclada de cerro a cerro. Su envolvente acristalada busca integrar el paisaje cordillerano como parte de la experiencia espacial, respondiendo a las necesidades de un fotógrafo mediante una relación constante entre habitar, observar y capturar el entorno natural.',
    images: ['assets/images/proyecto_5_vivienda.png'],
    link: '',
    tools: ['Rhinoceros 7', 'Twinmotion', 'Adobe Photoshop'],
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



