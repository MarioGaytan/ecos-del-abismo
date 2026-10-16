# Ecos del Abismo

*Un roguelite de acción hiper-ligero: menos de 200 KB, sin instalar nada, directo en el navegador.*

Quería un juego como los que más disfruto (*Vampire Survivors*, *Hades*, *Risk of Rain 2*): partidas cortas, hordas cada vez más frenéticas y mil caminos para armar una build absurdamente poderosa. Y quería que corriera en cualquier laptop, incluso en las más modestas, sin descargar nada. Así nació **Ecos del Abismo**.

Todo está hecho con HTML5 Canvas puro. No usa motor ni librerías, y tampoco imágenes ni sonidos externos: el pixel art está dibujado como texto dentro del código y la música y los efectos se sintetizan en tiempo real.

## Cómo jugarlo

- **En línea:** https://mariogaytan.github.io/ecos-del-abismo/
- **En tu compu:** descarga el repositorio y abre `index.html` con doble clic (Chrome o Edge).

Se juega con **teclado y ratón** en PC o con **controles táctiles** en el celular.

### Jugar sin internet 📲

El juego es una **PWA** (app web instalable): después de abrirlo una vez con internet, queda guardado en el dispositivo y funciona sin conexión.

- **Android (Chrome):** abre la página y toca *📲 Instalar juego* en el menú, o *⋮ → Instalar app*. Queda como app con su ícono, en pantalla completa y en horizontal.
- **PC (Chrome o Edge):** botón *📲 Instalar juego*, o el ícono de instalar en la barra de direcciones. Se abre en su propia ventana, incluso sin internet.
- **iPhone (Safari):** *Compartir → Añadir a pantalla de inicio*.
- **Descargar el .zip** (botón *⬇ Descargar .zip* en PC): descomprime y abre `index.html` con doble clic. Funciona sin internet y sin instalar nada.

**¿Y un APK de verdad?** Entra en [PWABuilder](https://www.pwabuilder.com), pega la URL del juego y elige *Android → Generate package*. Te descarga un APK (para instalar directo en el teléfono) y un AAB (para Google Play), sin instalar Android Studio.

### En el celular 📱

El juego detecta si el dispositivo es táctil y activa los controles en pantalla:

- **Pulgar izquierdo** (en cualquier punto de la mitad izquierda): stick para moverte.
- **Pulgar derecho**: stick para apuntar y disparar. Si no lo usas, el héroe apunta y dispara solo al enemigo más cercano.
- **Botones**: 💨 dash, ✴️ habilidad, ⭐ definitiva, 📜 build, ⏸ pausa y ⛶ pantalla completa (aparece si se sale de ella).
- Los menús se reacomodan en pantallas bajas: el menú principal va en dos columnas, las cartas en una sola fila y la encrucijada con la tienda y los caminos lado a lado. Además ignoran los toques accidentales del primer medio segundo.

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

Elijo un héroe, bajo al Abismo y sobrevivo dos minutos y medio a oleadas que no paran de crecer. Luego aparece el jefe del nivel. Si lo derroto, abro su cofre, cruzo el portal y elijo qué camino tomar hacia el siguiente nivel. Son cinco niveles, cada uno más hondo que el anterior (al pasar de nivel caes al siguiente), y cada partida empieza desde cero.

### Modos y dificultad

- **⚔ Campaña:** los 5 niveles del descenso, cada uno con su jefe.
- **∞ Hordas infinitas:** un solo mapa gigante (unas 3 veces más grande) que mezcla bosque, cripta, forja, raíces y vacío. Los enemigos cambian según el bioma que pisas y la **amenaza** sube cada 30 segundos sin parar. Cada 3 minutos llega un jefe; al derrotarlo subes una **Ascensión** (más enemigos, más élites, hordas mezcladas de los 3 biomas y +1 re-tirada) y su portal lleva al Altar de Almas. El reto es ver cuánto aguantas.
- **Dificultad:** 🌱 Fácil, ⚔️ Normal, 🔥 Difícil, 💀 Pesadilla o 👹 Tryhard. Cambia la experiencia y la vida, el daño y la cantidad de enemigos. Las más difíciles dan más Esencia. La probabilidad de que un élite (minijefe) suelte cofre también depende de ella: 100% / 70% / 40% / 20% / 12% (los élites sorpresa que salen de la horda, la mitad).
- **Sin farmeo:** cada dificultad limita cuántos santuarios puedes activar por nivel (Fácil 4, Normal 3, Difícil 3, Pesadilla 2, Tryhard 2) y todos se apagan cuando llega el jefe, así que hay que elegir. El jefe tiene un reloj (180/150/120/100/80 s): si se acaba, entra en **furia** (más daño y velocidad, el doble de esbirros y estos ya no dan experiencia). Tras vencerlo tienes unos segundos (40/30/25/20/15) antes de que el portal te absorba. En el infinito, tras cada jefe se reavivan los santuarios que no usaste.
- **👹 Tryhard:** para los que se creen pros. Enemigos con +120% de vida y +90% de daño, +45% de enemigos, el doble de élites, -35% de experiencia, solo un corazón en el suelo a la vez (y salen la mitad), sin imanes, -30% de rango de recogida, toda la curación a la mitad, sin re-tirada inicial y **sin el Árbol de rutas**. Da x3 Esencia.
- **Progreso permanente (Esencia):** la Esencia que ganas al terminar cada partida compra diseños, **habilidades nuevas** (una 3ª habilidad por héroe: *Salto Sísmico*, *Prisión Arcana* y *Señuelo*, ✦250 cada una) y nodos del **🌳 Árbol de rutas**. El árbol tiene 3 rutas (Supervivencia, Poder y Exploración) con 15 nodos comprables (✦80–250: más vida, daño, crítico, re-tiradas, visión, empezar con un punto extra de afinidad…). Cada nodo pide uno de los de arriba. Los héroes que se añadan podrán bloquearse con precio y comprarse desde su tarjeta del menú.
- **Reliquias:** en salas secretas (35%), cumbres (30%), criptas hundidas (35%), puzles (25%) y jefes (15%) puede aparecer una reliquia brillante rosa. Al recogerla desbloquea algo **para siempre**, aunque mueras en esa partida: los 3 nodos 🔮 del árbol que no se pueden comprar (*Pluma Ancestral*, *Corona Rota*, *Llave Maestra*) o los tomos de las habilidades nuevas. Nunca salen repetidas.
- **Ritmo de combate:** el juego estima tu daño por segundo y acerca la vida de los enemigos a unos tiempos objetivo: un enemigo normal cae en 1–3 s, un élite en unos 10 s y un jefe en 30 s o más. Un golpe normal te quita alrededor del 6–10% de tu vida. Es una mezcla, no un reemplazo: mejorar tu daño o tu vida se sigue notando, pero nada se vuelve una esponja.
- **Curación limitada:** las curaciones pasivas (robo de vida, regeneración, vampirismo, zonas sagradas…) comparten un tope por segundo (2,5% de tu vida + 2), y durante 1,5 s después de recibir un golpe curan la mitad. Corazones, fuentes y elixires curan de golpe y sin tope, pero son escasos.
- **Escudo de energía:** una burbuja visible que absorbe el daño antes que la vida. Se rompe con un estallido y se reconstruye sola tras 4 s sin recibir golpes. Se consigue con *Barrera de Energía* (y se acelera con *Condensador*); el Mago empieza con un poco.
- **Objetos temporales:** máximo 3 corazones y 1 imán en el mapa a la vez. Corazones (15 s), imanes (20 s) y almas (30 s) desaparecen si no los recoges, y parpadean antes.
- **Grietas del Abismo:** si te quedas quieto más de 5 s, se abren grietas bajo tus pies (aviso rojo y daño fuerte), cada vez más seguido. Aunque tu build esté rota, tienes que moverte, esquivar y no dejarte acorralar.
- **El Abismo crece contigo:** cada nivel que subes trae algo más de enemigos y más resistentes, y cada 10 niveles te lo avisa. Ese extra no da más experiencia, así que no se puede abusar.
- **Ira del Abismo:** si arrasas sin recibir daño, el Abismo se enfada y manda más enemigos y más resistentes (sin dar más experiencia). Si vas mal, se calma. Así el reto se mantiene sin volverse imposible.

### Los héroes

| Héroe | Precio | Afinidad | Estilo | Ataques a elegir | Habilidades a elegir | Definitiva |
|---|---|---|---|---|---|---|
| **Guerrero / Guerrera** | gratis | 🩸 Sangre | Cuerpo a cuerpo, mucho aguante | Mandoble · Lanza | Torbellino · Grito de Guerra · *Salto Sísmico* | Furia del Titán |
| **Mago / Maga** | gratis | 🔮 Arcano | Proyectiles, frágil pero explosivo | Proyectil Arcano · Bola de Fuego | Nova Helada · Parpadeo · *Prisión Arcana* | Lluvia de Meteoros |
| **Pícaro / Pícara** | gratis | 🌑 Oscuridad | Velocidad, críticos y esquiva | Dagas · Ballesta | Abanico de Cuchillas · Bomba de Humo · *Señuelo* | Danza Sombría |
| **Druida** | ✦500 | 🪨 Tierra | Control: espinas, raíces y forma de oso. +0.8 vida/seg | Espinas · Látigo de Enredadera | Forma de Oso · Raíces Atrapadoras | Bosque Viviente |
| **Berserker** | ✦600 | 🩸 Sangre | Hasta +50% daño cuanta menos vida; nunca tiene escudo | Hachas Gemelas · Mazazo | Carga Brutal · Rugido Sanguinario (miedo) | Frenesí (no puede morir) |
| **Elfo / Elfa** | ✦500 | ninguna | Arquero veloz; ninguna afinidad sale favorecida, +30% recogida | Arco Largo · Ráfaga | Trampa de Lianas · Salto Atrás | Lluvia de Flechas |
| **No-Muerto / No-Muerta** | ✦700 | 🌑 Oscuridad | Esqueletos aliados; robo de vida doble y corazones a la mitad. Solo le salen Oscuridad, Sangre, Hielo, Arcano y Rayo | Toque Necrótico · Guadaña | Alzar Esqueletos · Drenar Vida | Ejército de Huesos |

Las habilidades en *cursiva* se compran (✦250) o se encuentran como tomo. En **🎨 Personalizar** eliges la variante (masculina o femenina), le pones **nombre** a tu héroe (sale en el HUD y en la pantalla final) y cambias sus colores por partes. Los héroes de pago se ven en el menú con 🔒: al elegirlos aparece su ficha con el botón de compra.

### Cómo se sube de poder

Lo que más me importaba era que hubiera **muchas formas de romper el juego**:

- **9 afinidades (escuelas de poder)**: 🔥 Fuego, ❄️ Hielo, 🪨 Tierra, 🌪️ Viento, ✨ Luz, 🌑 Oscuridad, ⚡ Rayo, 🩸 Sangre y 🔮 Arcano. Cada mejora suma puntos a una afinidad, y con **3, 6 y 9 puntos** se desbloquean poderes cada vez más locos (enemigos que explotan al morir, pilares de roca, un tornado que te orbita, rayos de luz que castigan al más fuerte…). Las cartas se inclinan hacia lo que ya tienes, así que hiperespecializarse es viable.
- **Afinidades opuestas:** Fuego/Hielo, Tierra/Viento y Luz/Oscuridad se excluyen. Al despertar una (su primer punto), la opuesta queda **sellada** el resto de la partida: sus cartas y armas ya no salen. La carta que sellaría algo lo avisa ("⚠ Sella…") y el panel TAB muestra las selladas. Rayo, Sangre y Arcano combinan con todo. Cada héroe empieza con un punto en su afinidad (el Pícaro con Oscuridad, así que empieza con la Luz sellada).
- **30 sinergias híbridas**: con 3 puntos en dos afinidades compatibles se activa un efecto combinado. Por ejemplo, Tierra + Fuego es *Magma* (tus grietas son de lava) y Rayo + Oscuridad es *Paso Fantasma*. Así mezclar también vale la pena.
- **28 mejoras en 4 rarezas** (Común, Raro, Épico, Legendario). La rareza multiplica el efecto.
- **9 armas automáticas** (máximo 4 a la vez). Un arma a nivel 5 con 6 puntos en su afinidad **evoluciona**: *Sol Negro*, *Ventisca Eterna*, *Juicio del Cielo*, *Mil Filos*, *Legión Carmesí*, *Cataclismo*, *Avalancha*, *Huracán* y *Supernova*.
- **Racha de combate**: cada baja seguida da hasta +25% de experiencia, con premios en x25, x50, x100… Se corta si paso 2.5 segundos sin matar.
- **Las gemas de experiencia se desvanecen** si no las recoges en 40 segundos: hay que moverse. Con 3 mejoras de Imán puede aparecer **Singularidad**, que cada 12 s atrae todas las gemas del mapa.
- **Solo aparecen mejoras que sirven:** si una estadística llegó a su tope, o una mejora no combina con tu build (perforación sin proyectiles, daño de quemadura sin nada que queme…), no se ofrece.
- **Topes para que nada se rompa:** crítico máx. 80%, daño crítico x4, 6 proyectiles extra, área x2.6, robo de vida 12%, esquiva 60%; la velocidad de ataque rinde la mitad pasado x2, y el rayo en cadena tiene un límite por segundo.
- **Esquiva perfecta:** el dash te hace invulnerable. Si lo haces justo cuando una bala o un enemigo está encima, el tiempo se ralentiza, recuperas la carga, lanzas una onda de choque y ganas +25% de daño durante 3 s.
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
- **Salas secretas:** pequeñas salas talladas dentro de la roca, con un cofre épico. La entrada no está señalada, pero se distingue: un arco tapiado y agrietado, una corriente de aire tenue y escombros en el suelo delante. Camina hacia ella para abrirla. Hasta entonces los enemigos no pueden entrar, y el minimapa no la delata.
- **Alturas:** el bosque y la forja tienen **mesetas** (y a veces una **cumbre** encima), y la cripta tiene **criptas hundidas**. Solo se sube y se baja por rampas o escaleras; con el **dash** puedes saltar desde un risco, pero la caída hace daño (8% de tu vida por un nivel, 22% por dos; nunca te mata). Desde lo alto haces +15% de daño a los enemigos de abajo y ves más lejos. Los enemigos de a pie no te tocan desde otro nivel: tienen que rodear por las rampas, que se vuelven cuellos de botella. El parpadeo del pícaro sí sube riscos.
  - **Cumbre:** tiene un estandarte y un cofre épico a la vista; al subir salta una emboscada.
  - **Cripta hundida:** al bajar se oscurece y los muertos despiertan (con un élite). Si los vences, el sarcófago se abre y da un cofre épico.
- **Animaciones:** los héroes respiran en reposo, mueven las piernas al caminar y hacen el gesto de su ataque (espadazo, báculo en alto, lanzar dagas), y los jefes se animan según lo que hacen (el Rey Limo se aplasta y abre la boca, el Liche alza los brazos al conjurar, el Señor de la Forja levanta los puños). Los fotogramas son "diferencias" sobre el dibujo base en `js/sprites.js` (`ANIM`), así que añadir uno es cambiar unas pocas filas de texto.
- **Nada te tapa:** los muros, árboles y rocas que quedan delante del personaje se vuelven translúcidos, y si un muro te cubre se ve tu silueta.
- **Puzles:** *Runas de memoria* (la tablilla muestra una secuencia de símbolos; písalos en ese orden, y si te equivocas aparecen enemigos) y *Braseros* (enciende los 4 a la vez antes de que se apaguen). Al resolverlos ganas una mejora épica o mejor.
- **Niebla de guerra**: el mapa se revela conforme lo exploro.

### Los niveles

| Nivel | Bioma | Jefe |
|---|---|---|
| 1 | **Bosque Sombrío** | **Rey Limo**: salta sobre ti, escupe anillos de baba e invoca crías |
| 2 | **Cripta Helada** (oscura, con luz solo alrededor del héroe) | **Liche de Escarcha**: espirales de balas, teletransporte y zonas de hielo |
| 3 | **Forja Infernal** | **Señor de la Forja**: embestidas de fuego, oleadas en anillo y lluvia de meteoros |
| 4 | **Raíces Hundidas** (1100 m): caverna bioluminiscente con agua negra que frena y apaga quemaduras y esporas venenosas. Hongos que se dividen, anguilas que embisten, arañas que disparan | **Madre Raíz**: raíces bajo tus pies, nubes de esporas, espiral de semillas, se hunde y emerge a tu lado |
| 5 | **El Corazón del Abismo** (1700 m): islas de obsidiana sobre el vacío. **Grietas al vacío**: si caes, pierdes 15% de vida (puede matarte) y vuelves al último suelo firme lejos del borde, quieto un instante; con el dash se saltan, y los enemigos de a pie las rodean. Ojos flotantes, devoradores y **ecos** (sombras de tu propio héroe) | **La Voz del Abismo**: brazos de energía giratorios, te atrae hacia ella, invoca ecos y **desmorona el suelo** bajo tus pies (vuelve a los 6 s) |

Cada jefe tiene una segunda fase al quedarle la mitad de la vida. Al pasar de nivel, el héroe **cae** al siguiente (líneas de velocidad, aterrizaje con onda de choque y la profundidad alcanzada). Para probar, en el menú se puede empezar directamente en cualquier nivel con subidas de nivel acumuladas (9, 19, 27 o 34). El modo infinito mezcla los 5 biomas (las grietas al vacío solo aparecen en sus regiones de vacío) y rota los 5 jefes: la Madre Raíz es el 4.º y La Voz del Abismo el 5.º.

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
sw.js             Service worker: guarda el juego para jugar sin internet
manifest.webmanifest  Datos de la app instalable (nombre, ícono, horizontal)
icons/            Íconos de la app
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

La Esencia, los diseños, héroes, habilidades, nodos del árbol, reliquias y las opciones se guardan en el navegador (`localStorage`). Cada navegador o dominio tiene su propio guardado.

---

Si lo juegas, me encantaría saber qué build te funcionó mejor o qué combinación terminó rompiendo el juego. 🔥❄️⚡
