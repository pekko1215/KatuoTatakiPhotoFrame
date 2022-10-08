//  注! グローバル変数にworldという名前でb2World用変数を用意しておかないと落ちる.
let world;

const scaler = ([x, y]) => [x / 2, y / 2]

const boundsNodes = [[-1, 0], [1, 0], [1.5, 3], [-1.5, 3]].map(scaler); //  境界形状
const floaters = [
];


const kobatiElements = [
    [...document.querySelectorAll("#kobatiArea .img-area:nth-child(1) img")],
    [...document.querySelectorAll("#kobatiArea .img-area:nth-child(2) img")],
    [...document.querySelectorAll("#kobatiArea .img-area:nth-child(3) img")],
]

const kobatiSelectList = [0, 0, 0];

const waterColors = [
    d3.hsl(27, 0.46, 0.48, 1),
    d3.hsl(27, 0.66, 0.48, 1),
    d3.hsl(0, 1, 1, 1),
    d3.hsl(120, 0.72, 0.18, 1),
]

const waterShape = [
    "circle",
    "circle",
    "circle",
    "circle",
]

const pgDefs = [      //  particleGroup毎の初期形状
    { nodes: [[-0.2, 0.1], [1, 0.1], [1, 1.5], [-0.2, 1.5]].map(scaler) },
    { nodes: [[-0.2, 0.1], [-0.8, 0.1], [-0.8, 2.5], [-1, 1.0]].map(scaler) },
    { nodes: [[-0.2, -1], [0.2, -1], [0.2, 0.6], [-0.2, 0.6]].map(scaler) },
    { nodes: [[-0.2, -0.4], [0.2, -0.4], [0.2, 0.4], [-0.2, 0.4]].map(scaler) }
];

const timeStep = 1.0 / 60.0, velocityIterations = 2, positionIterations = 1;

const $cameraArea = document.querySelector("#cameraArea");
const $kobatiArea = document.querySelector("#kobatiArea");
const $misosoupArea = document.querySelector("#misosoupArea");
const $ohitashiArea = document.querySelector("#ohitashiArea");
const $view = document.querySelector("#view");
const $video = document.querySelector("#video")
const $viewLoader = document.querySelector("#viewLoader")

const liquidFunWorld = {
    init() {
        const gravity = new b2Vec2(0, -10);
        let boundsBody, boxShape;
        let psd, particleSystem;

        // 環境定義
        world = new b2World(gravity);

        // 剛体(static) 関連
        boundsBody = world.CreateBody(new b2BodyDef());
        boxShape = new b2ChainShape();
        boxShape.vertices = boundsNodes.map(function (node) {
            return new b2Vec2(node[0], node[1]);
        });
        boxShape.CreateLoop();
        boundsBody.CreateFixtureFromShape(boxShape, 0);

        // 剛体(dyanmic)関連ここから
        // floaters.forEach(function (floaterDef) {
        //     const dynamicBodyDef = new b2BodyDef();
        //     dynamicBodyDef.type = b2_dynamicBody;
        //     body = world.CreateBody(dynamicBodyDef);
        //     shape = new b2ChainShape();
        //     shape.vertices = floaterDef.nodes.map(function (node) {
        //         return new b2Vec2(node[0], node[1]);
        //     });
        //     shape.CreateLoop();
        //     body.CreateFixtureFromShape(shape, 1);
        //     body.SetTransform(new b2Vec2(floaterDef.pos[0], floaterDef.pos[1]), 0);
        //     // 質量定義
        //     body.SetMassData(new b2MassData(0.1, new b2Vec2(0, 0), 0.03));
        // });

        // Particle モジュール関連ここから
        psd = new b2ParticleSystemDef();
        psd.radius = 0.05;               // 粒子半径
        psd.dampingStrength = 0.1; // 減衰の強さ

        particleSystem = world.CreateParticleSystem(psd);

        pgDefs.forEach((def) => {
            const shape = new b2PolygonShape(), pd = new b2ParticleGroupDef();
            shape.vertices = def.nodes.map((node) => {
                return new b2Vec2(node[0], node[1]);
            });
            pd.shape = shape;
            particleSystem.CreateParticleGroup(pd);
        });

    },
    update() {
        world.Step(timeStep, velocityIterations, positionIterations);
    }
};

const init = function () {
    liquidFunWorld.init();
    d3Renderer.init();
    window.onresize = d3Renderer.resize;
    render();
};

const frameSkipLate = 2;
let frames = frameSkipLate;

const render = function () {
    window.requestAnimationFrame(render);
    if (frames-- !== 0) return;
    setTimeout(() => {
        liquidFunWorld.update();
        d3Renderer.render(world);
    })
    frames = frameSkipLate;
};

const d3Renderer = {
    init() {
        const viz = d3.select($misosoupArea).append('svg').attr('id', 'viz').append('g').classed('world', true);
        d3Renderer.resize();
    },
    render(world) {
        const viz = d3.select('svg#viz g.world');
        d3Renderer.drawBodies(viz, world.bodies);
        d3Renderer.drawParicles(viz, world.particleSystems[0]);
    },
    drawBodies(selection, bodies) { // 剛体描画用
        const bounds = d3.svg.line().x(function (vec) { return vec.x; }).y(function (vec) { return vec.y; });
        const bodyGroups = selection.selectAll('g.body').data(bodies, function (b) {
            return b.ptr;
        });
        bodyGroups.enter().append('g').classed('body', true).attr('fill', 'none').attr('stroke', 'black').attr('stroke-width', 0.01);
        bodyGroups.each(function (b) {
            d3.select(this).selectAll('path').data(b.fixtures).enter().append('path').attr('d', function (fixture) {
                return bounds(fixture.shape.vertices);
            });
        });
        bodyGroups.attr('transform', function (b) {
            const pos = b.GetPosition(), angle = b.GetAngle() * 180 / Math.PI;
            return 'translate(' + pos.x + ', ' + pos.y + '), rotate(' + angle + ')';
        });
        bodyGroups.exit().remove();
    },
    drawParicles(selection, system) { // 流体粒子描画用
        const particleGroup = selection.selectAll('g.particle').data(system.particleGroups)
        const positionBuf = system.GetPositionBuffer();
        particleGroup.enter().append('g').classed('particle', true).attr('fill', function (d, i) {
            return waterColors[i]
        });
        particleGroup.each(function (pg, i) {
            const dataSet = d3.select(this).selectAll('circle').data(new Array(pg.GetParticleCount()));
            const offset = pg.GetBufferIndex();
            dataSet.enter().append(waterShape[i]).attr('r', system.radius)
            dataSet.attr('cx', function (d, i) {
                return positionBuf[(i + offset) * 2];
            }).attr('cy', function (d, i) {
                return positionBuf[(i + offset) * 2 + 1];
            });
            dataSet.exit().remove();
        });
        particleGroup.exit().remove();
    },
    resize() {
        const rect = $misosoupArea.getBoundingClientRect();

        const w = rect.width, h = rect.height;
        const scale = (w < h ? w : h) * 0.23;
        const viz = d3.select('svg#viz');
        viz.style('width', '100%').style("height", "100%")//.style('height', h + 'px');
        const translate = 'translate(' + (w / 2) + ', ' + (h / 2 + scale * 2) + ')';
        const scaleStr = 'scale(' + scale + ', ' + (-scale) + ')';
        viz.select('g').attr('transform', [translate, scaleStr].join());
    }
};

$viewLoader.addEventListener("click", async e => {
    document.body.removeChild($viewLoader);

    navigator.mediaDevices = navigator.mediaDevices || ((navigator.mozGetUserMedia || navigator.webkitGetUserMedia) ? {
        getUserMedia: function (c) {
            return new Promise(function (y, n) {
                (navigator.mozGetUserMedia ||
                    navigator.webkitGetUserMedia).call(navigator, c, y, n);
            });
        }
    } : null);
    if ('getUserMedia' in navigator.mediaDevices === false) {
        const h3 = document.createElement("h3");
        h3.innerText = "カメラがある端末で見てね";
        h3.style.textAlign = "center";
        $view.appendChild(h3);
    } else {
        const stream = await navigator.mediaDevices.getUserMedia({
            audio: false,
            video: {
                facingMode: "environment",
            }
        })
        $video.srcObject = stream;
        $video.onloadedmetadata = () => {
            $video.play();
        };
        init();
        setInterval(() => {
            world.SetGravity(new b2Vec2(Math.floor(Math.random() * 20) - 10, -10));
            setTimeout(() => {
                world.SetGravity(new b2Vec2(0, -10));
            }, 500)
        }, 2000)
        const ohitasiSlot = () => {
            kobatiElements.map(list => {
                const target = Math.floor(Math.random() * list.length);
                list.map((e, i) => i === target ? e.classList.remove("hidden") : e.classList.add("hidden"));
            })
            setTimeout(ohitasiSlot, 500);
        }
        ohitasiSlot();
    }
})
