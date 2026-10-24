// Тест 1 «Одним росчерком». Данные фигур: V — точки (viewBox 640x520), E — линии (пары индексов точек).
// Шесть основных проб в порядке, заданном автором: image 18, 14, 21, 16, 23, 22.
// Тесты линейки идут в порядке массива TESTS. Поле kind говорит, каким движком тест показывать: euler или choice.
var TESTS = [
  {
    id: 'euler',
    kind: 'euler',
    title: 'Одним росчерком',
    short: 'Росчерк',
    train: [{"id": "t1", "file": "Обучение 1: квадрат", "V": [[116.0, 56.0], [524.0, 56.0], [524.0, 464.0], [116.0, 464.0]], "E": [[0, 1], [1, 2], [2, 3], [3, 0]], "labels": null, "solvable": true, "hit": 38}, {"id": "t2", "file": "Обучение 2: квадрат с хвостиком", "V": [[320.7, 56.0], [169.5, 209.8], [470.5, 209.8], [320.7, 359.7], [320.7, 464.0]], "E": [[0, 2], [2, 3], [3, 1], [1, 0], [3, 4]], "labels": null, "solvable": true, "hit": 38}],
    probes: [{"id": "m1", "file": "image(18).png", "V": [[320.0, 56.0], [523.7, 56.0], [116.3, 56.0], [320.1, 191.9], [523.7, 192.0], [523.7, 464.0], [116.3, 464.0]], "E": [[0, 1], [0, 2], [0, 3], [1, 4], [2, 6], [3, 4], [4, 5], [4, 6], [5, 6]], "labels": null, "solvable": true, "hit": 38, "typ": "путь", "src": "p01"}, {"id": "m2", "file": "image_14_.png", "V": [[232.6, 56.0], [523.7, 56.0], [407.2, 172.5], [116.2, 172.5], [523.8, 347.4], [407.2, 464.0], [116.2, 464.0]], "E": [[0, 1], [0, 3], [1, 2], [1, 4], [2, 3], [2, 5], [3, 5], [3, 6], [4, 5], [5, 6]], "labels": null, "solvable": true, "hit": 38, "typ": "путь", "src": "p02"}, {"id": "m3", "file": "image(21).png", "V": [[455.9, 56.0], [320.0, 56.0], [184.0, 146.7], [501.3, 192.0], [274.7, 237.3], [138.7, 327.9], [455.9, 373.3], [320.0, 464.0]], "E": [[0, 1], [0, 3], [1, 2], [1, 4], [1, 5], [2, 5], [3, 6], [4, 5], [4, 6], [5, 7], [6, 7]], "labels": null, "solvable": true, "hit": 38, "typ": "путь", "src": "p03"}, {"id": "m4", "file": "image_16_.png", "V": [[320.0, 56.0], [167.2, 56.0], [472.8, 56.0], [320.0, 260.0], [167.2, 260.0], [472.8, 464.0], [167.2, 464.0], [320.0, 464.0]], "E": [[0, 1], [0, 3], [1, 4], [2, 3], [2, 5], [3, 4], [3, 5], [3, 7], [4, 6], [6, 7]], "labels": null, "solvable": true, "hit": 38, "typ": "путь", "src": "p04"}, {"id": "m5", "file": "image(23).png", "V": [[365.3, 56.0], [501.3, 237.4], [320.0, 328.0], [138.7, 328.0], [320.0, 464.0], [138.7, 464.0]], "E": [[0, 1], [0, 2], [0, 3], [1, 2], [1, 3], [1, 4], [2, 3], [2, 4], [3, 4], [3, 5], [4, 5]], "labels": null, "solvable": true, "hit": 38, "typ": "путь", "src": "p05"}, {"id": "m6", "file": "image(22).png", "V": [[320.0, 56.0], [279.2, 137.5], [360.8, 137.5], [320.0, 260.0], [523.9, 260.0], [116.1, 260.0], [320.0, 382.5], [523.9, 464.0], [116.1, 464.0]], "E": [[0, 1], [0, 2], [1, 3], [1, 5], [1, 8], [2, 3], [2, 4], [2, 7], [3, 4], [3, 5], [6, 7], [6, 8]], "labels": null, "solvable": true, "hit": 36.7, "typ": "цикл", "src": "p08"}]
  },
  {
    // Тест 2: найти картинку, которая подходит вместо знака вопроса. answer — номер варианта слева направо (1–5).
    id: 'matrix',
    kind: 'choice',
    title: 'Закономерности',
    short: 'Закон.',
    probes: [
      { id: 'q1', img: 'img/matrix/q1.png', options: ['img/matrix/q1-1.png', 'img/matrix/q1-2.png', 'img/matrix/q1-3.png', 'img/matrix/q1-4.png', 'img/matrix/q1-5.png'], answer: 5 },
      { id: 'q2', img: 'img/matrix/q2.png', options: ['img/matrix/q2-1.png', 'img/matrix/q2-2.png', 'img/matrix/q2-3.png', 'img/matrix/q2-4.png', 'img/matrix/q2-5.png'], answer: 3 },
      { id: 'q3', img: 'img/matrix/q3.png', options: ['img/matrix/q3-1.png', 'img/matrix/q3-2.png', 'img/matrix/q3-3.png', 'img/matrix/q3-4.png', 'img/matrix/q3-5.png'], answer: 2 },
      { id: 'q4', img: 'img/matrix/q4.png', options: ['img/matrix/q4-1.png', 'img/matrix/q4-2.png', 'img/matrix/q4-3.png', 'img/matrix/q4-4.png', 'img/matrix/q4-5.png'], answer: 2 },
      { id: 'q5', img: 'img/matrix/q5.png', options: ['img/matrix/q5-1.png', 'img/matrix/q5-2.png', 'img/matrix/q5-3.png', 'img/matrix/q5-4.png', 'img/matrix/q5-5.png'], answer: 3 },
      { id: 'q6', img: 'img/matrix/q6.png', options: ['img/matrix/q6-1.png', 'img/matrix/q6-2.png', 'img/matrix/q6-3.png', 'img/matrix/q6-4.png', 'img/matrix/q6-5.png'], answer: 1 }
    ]
  },
  {
    // Тест 3: из каких трёх частей складывается фигура. Нужно отметить ровно три варианта из шести.
    // scale — ширина фигуры относительно ширины плитки части, как на исходном экране (масштаб совпадает).
    // answer — номера правильных частей слева направо, сверху вниз (1–3 верхний ряд, 4–6 нижний).
    id: 'parts',
    kind: 'choice',
    title: 'Части фигуры',
    short: 'Части',
    pick: 3,
    layout: 'wide',
    ask: 'Из каких трёх частей можно сложить фигуру наверху? Выбери три картинки.',
    probes: [
      { id: 'p1', img: 'img/parts/p1.png', scale: 1.589, options: ['img/parts/p1-1.png', 'img/parts/p1-2.png', 'img/parts/p1-3.png', 'img/parts/p1-4.png', 'img/parts/p1-5.png', 'img/parts/p1-6.png'], answer: [3, 5, 6] },
      { id: 'p2', img: 'img/parts/p2.png', scale: 0.521, options: ['img/parts/p2-1.png', 'img/parts/p2-2.png', 'img/parts/p2-3.png', 'img/parts/p2-4.png', 'img/parts/p2-5.png', 'img/parts/p2-6.png'], answer: [1, 3, 5] },
      { id: 'p3', img: 'img/parts/p3.png', scale: 0.626, options: ['img/parts/p3-1.png', 'img/parts/p3-2.png', 'img/parts/p3-3.png', 'img/parts/p3-4.png', 'img/parts/p3-5.png', 'img/parts/p3-6.png'], answer: [2, 4, 6] },
      { id: 'p4', img: 'img/parts/p4.png', scale: 0.714, options: ['img/parts/p4-1.png', 'img/parts/p4-2.png', 'img/parts/p4-3.png', 'img/parts/p4-4.png', 'img/parts/p4-5.png', 'img/parts/p4-6.png'], answer: [3, 4, 6] },
      { id: 'p5', img: 'img/parts/p5.png', scale: 0.717, options: ['img/parts/p5-1.png', 'img/parts/p5-2.png', 'img/parts/p5-3.png', 'img/parts/p5-4.png', 'img/parts/p5-5.png', 'img/parts/p5-6.png'], answer: [1, 3, 4] },
      { id: 'p6', img: 'img/parts/p6.png', scale: 0.572, options: ['img/parts/p6-1.png', 'img/parts/p6-2.png', 'img/parts/p6-3.png', 'img/parts/p6-4.png', 'img/parts/p6-5.png', 'img/parts/p6-6.png'], answer: [3, 4, 5] }
    ]
  },
  {
    // Тест 4: какой кубик получится из развёртки. Три варианта: a = 1, b = 2, c = 3.
    id: 'cubes',
    kind: 'choice',
    title: 'Развёртка куба',
    short: 'Куб',
    labels: ['a', 'b', 'c'],
    layout: 'cube',
    ask: 'Из этой развёртки сложили кубик. Какой кубик получился? Нажми на него.',
    probes: [
      { id: 'c1', img: 'img/cubes/c1.png', options: ['img/cubes/c1-1.png', 'img/cubes/c1-2.png', 'img/cubes/c1-3.png'], answer: 1 },
      { id: 'c2', img: 'img/cubes/c2.png', options: ['img/cubes/c2-1.png', 'img/cubes/c2-2.png', 'img/cubes/c2-3.png'], answer: 2 },
      { id: 'c3', img: 'img/cubes/c3.png', options: ['img/cubes/c3-1.png', 'img/cubes/c3-2.png', 'img/cubes/c3-3.png'], answer: 1 },
      { id: 'c4', img: 'img/cubes/c4.png', options: ['img/cubes/c4-1.png', 'img/cubes/c4-2.png', 'img/cubes/c4-3.png'], answer: 1 },
      { id: 'c5', img: 'img/cubes/c5.png', options: ['img/cubes/c5-1.png', 'img/cubes/c5-2.png', 'img/cubes/c5-3.png'], answer: 3 },
      { id: 'c6', img: 'img/cubes/c6.png', options: ['img/cubes/c6-1.png', 'img/cubes/c6-2.png', 'img/cubes/c6-3.png'], answer: 3 }
    ]
  }
];
