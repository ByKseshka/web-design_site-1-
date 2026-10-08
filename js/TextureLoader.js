// ============================================================
// TextureLoader.js — загрузка пользовательских текстур через FileReader
// ============================================================

export class TextureLoader {
  constructor() {
    // Кэш: {key: {img: HTMLImageElement, dataURL: string}}
    this.textures = {};
  }

  // Загрузить одну текстуру из File
  loadFromFile(key, file) {
    return new Promise((resolve, reject) => {
      if (!file) { reject(new Error('Файл не выбран')); return; }
      const reader = new FileReader();
      reader.onload = (e) => {
        const dataURL = e.target.result;
        const img = new Image();
        img.onload = () => {
          this.textures[key] = { img, dataURL };
          resolve(dataURL);
        };
        img.onerror = () => reject(new Error('Ошибка загрузки изображения'));
        img.src = dataURL;
      };
      reader.onerror = () => reject(new Error('Ошибка чтения файла'));
      reader.readAsDataURL(file);
    });
  }

  // Загрузить из dataURL (при восстановлении из localStorage)
  loadFromDataURL(key, dataURL) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => {
        this.textures[key] = { img, dataURL };
        resolve();
      };
      img.onerror = () => reject(new Error('Ошибка восстановления изображения'));
      img.src = dataURL;
    });
  }

  get(key) {
    return this.textures[key]?.img || null;
  }

  has(key) {
    return !!this.textures[key];
  }

  remove(key) {
    delete this.textures[key];
  }

  clearAll() {
    this.textures = {};
  }

  // Собрать все текстуры в JSON для сохранения
  // Возвращает: {key: dataURL}
  serialize() {
    const out = {};
    for (const k in this.textures) out[k] = this.textures[k].dataURL;
    return out;
  }

  // Оценка общего размера dataURL (приблизительно)
  totalSize() {
    let size = 0;
    for (const k in this.textures) size += this.textures[k].dataURL.length;
    return size;
  }
}