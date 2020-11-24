#include <stdint.h>
#include <math.h>

#ifdef __EMSCRIPTEN__
  #include <emscripten/emscripten.h>
#else
  #define EMSCRIPTEN_KEEPALIVE
#endif

#ifdef __cplusplus
extern "C" {
#endif

float EMSCRIPTEN_KEEPALIVE tick(
  unsigned char inputBuf[],
  uint16_t w,
  uint16_t h,
  uint16_t box_x,
  uint16_t box_y,
  uint16_t box_s,
  float rawMem[],
  uint16_t rawMemSize,
  uint16_t rawMemIndex,
  float amp[]
) {
  long sum = 0;
  for (int y = box_y; y < box_y + box_s; y++) {
    for (int x = box_x; x < box_x + box_s; x++) {
      sum += inputBuf[(y * w + x) * 4 + 1];
    }
  }

  float raw = (float)sum / box_s / box_s;
  rawMem[rawMemIndex] = raw;

  float rawSum = 0;
  for (int i = 0; i < rawMemSize; i++) {
    rawSum += rawMem[i];
  }

  float rawAvg = rawSum / rawMemSize;

  float devSum = 0;
  for (int i = 0; i < rawMemSize; i++) {
    devSum += pow(rawMem[i], 2) - pow(rawAvg, 2);
  }

  float rawDev = devSum / rawMemSize;

  float *mem = new float[rawMemSize];
  int memIndex = 0;

  for (int i = rawMemIndex + 1; i < rawMemSize; i++) {
    mem[memIndex++] = (rawMem[i] - rawAvg) / rawDev;
  }

  for (int i = 0; i <= rawMemIndex; i++) {
    mem[memIndex++] = (rawMem[i] - rawAvg) / rawDev;
  }

  float w0 = 2 * 3.1415 / rawMemSize;
  for (int i = 0; i < rawMemSize; i++) {
    float real = 1.0;
    float imag = 1.0;

    for (int j = 0; j < rawMemSize; j++) {
      real += mem[j] * cos(w0 * i * j);
      imag -= mem[j] * sin(w0 * i * j);
    }

    real /= rawMemSize;
    imag /= rawMemSize;
    amp[i] = sqrt(pow(real, 2) + pow(imag, 2));
  }

  delete[] mem;

  return (raw - rawAvg) / rawDev;
}


#ifdef __cplusplus
}
#endif
