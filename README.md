# Ecos del Abismo

*Un roguelite de acción hiper-ligero: menos de 200 KB, sin instalar nada, directo en el navegador.*

Quería un juego como los que más disfruto (*Vampire Survivors*, *Hades*, *Risk of Rain 2*): partidas cortas, hordas cada vez más frenéticas y mil caminos para armar una build absurdamente poderosa. Y quería que corriera en cualquier laptop, incluso en las más modestas, sin descargar nada. Así nació **Ecos del Abismo**.

Todo está hecho con HTML5 Canvas puro. No usa motor ni librerías, y tampoco imágenes ni sonidos externos: el pixel art está dibujado como texto dentro del código y la música y los efectos se sintetizan en tiempo real.

## Cómo jugarlo

- **En línea:** https://mariogaytan.github.io/ecos-del-abismo/
- **En tu compu:** descarga el repositorio y abre `index.html` con doble clic (Chrome o Edge).

Se juega con **teclado y ratón** en PC o con **controles táctiles** en el celular.

### En el celular 📱

El juego detecta si el dispositivo es táctil y activa los controles en pantalla:

- **Pulgar izquierdo** (en cualquier punto de la mitad izquierda): stick para moverte.
- **Pulgar derecho**: stick para apuntar y disparar. Si no lo usas, el héroe apunta y dispara solo al enemigo más cercano.
- **Botones**: 💨 dash, ✴️ habilidad, ⭐ definitiva, 📜 build y ⏸ pausa.

Se juega **en horizontal**: si el teléfono está en vertical aparece un aviso para girarlo y el juego se pausa. En Android, el botón *Pantalla completa* también fija la orientación. En móviles arranca en calidad baja para cuidar la batería y los FPS; se puede cambiar en *Opciones*.

| Tecla | Acción |
|---|---|
| `W A S D` / flechas | Moverse |
| Ratón | Apuntar |
| Clic izquierdo (mantener) | Ataque principal (`F` activa el auto-ataque) |
| Clic derecho / `E` | Habilidad de clase |
| `Espacio` / `Shift` | Dash (eres invulnerable durante el dash) |
| `Q` | Definitiva (se carga matando) |
| `Tab` (mantener) | Ver tu build |
| `Esc` / `P` | Pausa · `M` silenciar |
| `1-4` · `R` · `X` | Elegir carta · re-tirar · saltar |

## De qué va

Elijo un héroe, bajo al Abismo y sobrevivo dos minutos y medio a oleadas que no paran de crecer. Luego aparece el jefe del nivel. Si lo derroto, abro su cofre, cruzo el portal y elijo qué camino tomar hacia el siguiente nivel. Son tres niveles, y cada partida empieza desde cero.

### Los héroes

| Héroe | Estilo | Ataques a elegir | Habilidades a elegir |
|---|---|---|---|
| **Guerrero** | Cuerpo a cuerpo, mucho aguante | Mandoble · Lanza | Torbellino · Grito de Guerra |
| **Mago** | Proyectiles, frágil pero explosivo | Proyectil Arcano · Bola de Fuego | Nova Helada · Parpadeo |
| **Pícaro** | Velocidad, críticos y esquiva | Dagas · Ballesta | Abanico de Cuchillas · Bomba de Humo |

Cada uno tiene además su definitiva: *Furia del Titán*, *Lluvia de Meteoros* o *Danza Sombría*. También se pueden personalizar sus colores por partes (armadura, capa, túnica, capucha…).

### Cómo se sube de poder

Lo que más me importaba era que hubiera **muchas formas de romper el juego**:

- **6 escuelas de poder**: 🔥 Fuego, ❄️ Hielo, ⚡ Tormenta, 🩸 Sangre, 🗡️ Sombra y 🔮 Arcano. Cada mejora suma puntos a una escuela, y con **3, 6 y 9 puntos** se desbloquean poderes cada vez más locos (enemigos que explotan al morir, rayos que caen del cielo, críticos a x3…). Las cartas se inclinan hacia lo que ya tienes, así que hiperespecializarse es viable.
- **15 sinergias híbridas**: con 3 puntos en dos escuelas distintas se activa un efecto combinado. Por ejemplo, Fuego + Hielo es *Choque Térmico* y Tormenta + Sombra es *Paso Fantasma*. Así mezclar también vale la pena.
- **28 mejoras en 4 rarezas** (Común, Raro, Épico, Legendario). La rareza multiplica el efecto.
- **6 armas automáticas** (máximo 4 a la vez). Un arma a nivel 5 con 6 puntos en su escuela **evoluciona**: *Sol Negro*, *Ventisca Eterna*, *Juicio del Cielo*, *Mil Filos*, *Legión Carmesí* y *Cataclismo*.
- **Racha de combate**: cada baja seguida da más experiencia, con premios en x25, x50, x100… Se corta si paso 2.5 segundos sin matar.
- **Altar de Almas**: entre niveles gasto las almas de esa partida en fuerza, vida, elixires, re-tiradas o una pluma de fénix.
- **Encrucijada**: elijo 1 de 3 caminos, algunos seguros y otros malditos con mejor recompensa.

### Mapas que nunca se repiten

Cada nivel se genera de forma procedural cada vez que juegas:

- **Cuevas, plazas y túneles** generados con un autómata celular.
- **Terreno peligroso**: pantano, nieve o ceniza que te frenan; lava, zarzas o runas que dañan; **pendientes** que te empujan; y **hielo** donde cuesta frenar.
- **Trampas** de pinchos, escarcha y fuego. También dañan a los enemigos, así que se puede atraerlos hacia ellas.
- **Santuarios protegidos por un guardián**, con poder, curación, cofres o tiempo lento como premio… y un altar maldito para los valientes.
- **Zonas especiales**: la *Arboleda Sagrada* cura; la *Zona Maldita* da más experiencia a cambio de más peligro.
- **Cofres escondidos** en callejones sin salida.
- **Niebla de guerra**: el mapa se revela conforme lo exploro.

### Los niveles

| Nivel | Bioma | Jefe |
|---|---|---|
| 1 | **Bosque Sombrío** | **Rey Limo**: salta sobre ti, escupe anillos de baba e invoca crías |
| 2 | **Cripta Helada** (oscura, con luz solo alrededor del héroe) | **Liche de Escarcha**: espirales de balas, teletransporte y zonas de hielo |
| 3 | **Forja Infernal** | **Señor de la Forja**: embestidas de fuego, oleadas en anillo y lluvia de meteoros |

Cada jefe tiene una segunda fase al quedarle la mitad de la vida. Para probar, en el menú se puede empezar directamente en el nivel 2 o 3, con subidas de nivel acumuladas.

## Por qué "hiper-ligero"

Me propuse que el juego pesara poco y corriera fluido en una laptop normal:

- **Todo el juego pesa menos de 200 KB** y no tiene ni una imagen ni un archivo de audio externo.
- Uso una **rejilla espacial** para las colisiones, así no se compara cada enemigo con todos los demás.
- Los sprites se **rasterizan una sola vez** y se guardan en caché.
- Hay **topes** de partículas, proyectiles y textos, y las gemas de experiencia se fusionan cuando hay demasiadas.
- **Solo se dibuja lo que está en pantalla.**
- Los enemigos usan un **campo de flujo** (un BFS desde el jugador) para rodear muros sin un pathfinding costoso por cada uno.
- En *Opciones* hay un modo de **calidad baja** para equipos más modestos.

Es 2D visto desde arriba, en pixel art, con algunos trucos 2.5D (sombras, profundidad, saltos con altura e iluminación por bioma) para dar volumen sin el costo de un 3D real.

## Cómo está organizado

```
index.html        Interfaz (menús, cartas, overlays) y estilos
js/data.js        ← Balance: héroes, mejoras, armas, enemigos, jefes, niveles, tienda, cosméticos
js/sprites.js     Pixel art escrito como texto + rasterizador con contorno automático
js/audio.js       Efectos y música sintetizados con WebAudio
js/world.js       Generador procedural: cuevas, terreno, trampas, zonas, guardianes, niebla
js/game.js        Motor: bucle, combate, IA, jefes, oleadas, render y HUD
js/touch.js       Controles táctiles: doble stick, botones y aviso de orientación
js/ui.js          Menú, personalización, subida de nivel, encrucijada y fin de partida
```

Si quieres experimentar, casi todo el balance está en `js/data.js`:

- **Nuevo enemigo:** un sprite en `RAW` (sprites.js) y una entrada en `ENEMIES`, reutilizando una IA: `chase`, `bat`, `ranged`, `radial`, `charger`, `exploder` o `ghost`.
- **Nueva mejora:** un objeto en `UPGRADES` con su texto (`tx`) y su efecto (`ap`).
- **Nuevo diseño cosmético:** una opción en `CUSTOM`. Cada ranura reemplaza colores de la paleta del sprite.
- **Nuevo nivel:** un objeto en `LEVELS` (colores, props, enemigos, eventos y jefe).
- **Mapas:** la densidad de cuevas, trampas y zonas se ajusta en `genMap()` de `js/world.js`.

Los sprites son matrices de letras donde cada letra es un color de la paleta `PAL`. Se pueden editar directamente o reemplazar por PNG hechos en LibreSprite.

### Servidor local (opcional)

El juego funciona abriendo `index.html` directamente. Si prefiero servirlo:

```bash
python -m http.server 8765
```

y abro http://localhost:8765.

## Partidas guardadas

La Esencia, los diseños desbloqueados y las opciones se guardan en el navegador (`localStorage`). Cada navegador o dominio tiene su propio guardado.

---

Si lo juegas, me encantaría saber qué build te funcionó mejor o qué combinación terminó rompiendo el juego. 🔥❄️⚡
