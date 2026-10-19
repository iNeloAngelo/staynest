import { describe, expect, it } from 'vitest';
import { fitWithin, MAX_IMAGE_EDGE } from './compress';

describe('fitWithin', () => {
  it('уменьшает длинную сторону до 2000 px и сохраняет пропорции', () => {
    expect(fitWithin(4000, 3000)).toEqual({ width: 2000, height: 1500 });
    expect(fitWithin(3000, 4000)).toEqual({ width: 1500, height: 2000 });
  });

  it('не увеличивает маленькие изображения', () => {
    expect(fitWithin(800, 600)).toEqual({ width: 800, height: 600 });
  });

  it('округляет до целых пикселей и не даёт нуля', () => {
    expect(fitWithin(2001, 1)).toEqual({ width: MAX_IMAGE_EDGE, height: 1 });
  });
});
