#include <stdio.h>

#ifdef __EMSCRIPTEN__
  #include <emscripten/emscripten.h>
#else
  #define EMSCRIPTEN_KEEPALIVE
#endif

#ifdef __cplusplus
extern "C" {
#endif

// EMSCRIPTEN_KEEPALIVE int tick(unsigned char inputBuf[], int w, int h, CascadeClassifier* cco, float step, float delta, bool pp, float othresh, int nthresh) {
int EMSCRIPTEN_KEEPALIVE tick(void) {
  int x = 1 + 8 + 10;
  printf("EMS%d\n", x);
  return x;
}


#ifdef __cplusplus
}
#endif
