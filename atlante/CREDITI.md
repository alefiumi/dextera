# Crediti e licenze del prototipo 3D

- **Modelli 3D** (`*.glb`) e dati derivati (`dati.json`): tratti da
  [Z-Anatomy – The libre 3D atlas of anatomy](https://github.com/Z-Anatomy/Models-of-human-anatomy),
  licenza **CC BY-SA 4.0**, a sua volta derivato da
  **BodyParts3D, © The Database Center for Life Science, CC BY-SA 2.1 Japan**.
  I file sono stati semplificati e compressi con gli script in `build/`.
  Queste opere derivate sono distribuite con la stessa licenza, CC BY-SA 4.0.
- **Disegni 2D** (`content/corpo.json`, `content/cervello.json`): forme proiettate dagli stessi modelli
  con `build/proietta_2d.mjs` e `build/contenuti_2d.py`; opere derivate, anch'esse con licenza CC BY-SA 4.0.
  L'area di Wernicke non è nella fonte: è il terzo posteriore del giro temporale superiore (approssimazione).
- **Nomi italiani e latini**: Terminologia Anatomica 2, dal file `TA2.csv` di Z-Anatomy (CC BY-SA 4.0).
- **Testi di origine, inserzione, azione e innervazione** e tutti gli altri testi anatomici (`testi/`, con fonte e stato di ogni dato): scritti dall'AI, da verificare su un atlante.
- **three.js** (`vendor/`): licenza MIT, vedi `vendor/LICENSE-three.txt`.

Dall'atlante non sono state prese le parti con licenza non commerciale (orecchio interno, rene).
