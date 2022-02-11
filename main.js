import { World } from "./world.js";
import { View } from "./view.js";

const canvas = document.querySelector("canvas");
const context = canvas.getContext("2d");

let world = null;
let view = null;

let options = {
    width: 800,
    height: 800,
    chunkCount: 1000,
    lloydIters: 0,
    lloydOmega: 1,
};

canvas.onmousemove = (e) => {
    const rect = e.target.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    world.highlight(x, y);
};
canvas.onclick = (e) => {
    const rect = e.target.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    world.select(x, y);
    view.moveTo(x, y);
};

let description = document.getElementById("description");

function drawMap() {
    world.draw(context);
    if (world.selected) {
        description.innerHTML =
            "biome: " +
            world.selected.biome.name +
            "<br>" +
            "moisture: " +
            world.selected.moisture +
            "<br>" +
            "elevation: " +
            world.selected.z +
            "<br>" +
            "latitude: " +
            world.selected.latitude +
            "<br>" +
            "temperature: " +
            world.selected.temperature +
            "<br>" +
            "dist from coast: " +
            world.selected.distanceFromCoast +
            "<br>" +
            "dist from water: " +
            world.selected.distanceFromWater +
            "<br>" +
            "dist from freshwater: " +
            world.selected.distanceFromFreshwater +
            "<br>";
    }
}

function input(inputId, fn, outputId) {
    let input = document.getElementById(inputId);
    let output = null;
    if (outputId) {
        output = document.getElementById(outputId);
        output.innerHTML = input.value;
    }
    fn(input);
    input.oninput = function () {
        if (output) output.innerHTML = this.value;
        fn(this);
    };
}

input(
    "cellCount",
    (input) => (options.chunkCount = parseInt(input.value)),
    "cellCountView"
);
input(
    "lloydIters",
    (input) => (options.lloydIters = parseInt(input.value)),
    "lloydItersView"
);
input(
    "lloydOmega",
    (input) => (options.lloydOmega = parseFloat(input.value)),
    "lloydOmegaView"
);
input("drawBiomes", (input) => {
    if (world) {
        world.drawMoisture = false;
        world.drawTemperature = false;
        world.drawElevation = false;
    }
});
input("drawMoisture", (input) => {
    if (world) {
        world.drawMoisture = input.checked;
        world.drawTemperature = false;
        world.drawElevation = false;
    }
});
input("drawTemperature", (input) => {
    if (world) {
        world.drawMoisture = false;
        world.drawTemperature = input.checked;
        world.drawElevation = false;
    }
});
input("drawElevation", (input) => {
    if (world) {
        world.drawMoisture = false;
        world.drawTemperature = false;
        world.drawElevation = input.checked;
    }
});
input("drawGraph", (input) => {
    if (world) world.drawGraph = input.checked;
});

document.getElementById("generate").onclick = () => {
    world = new World(options);
    view.world = world;
};

world = new World(options);
view = new View(world);

let map = document.querySelector("#map");
let scene = document.querySelector("#scene");
let mapButton = document.querySelector("#mapBtn");
let sceneButton = document.querySelector("#sceneBtn");

let render = null;

function animate() {
    if (render) render();
    requestAnimationFrame(animate);
}
requestAnimationFrame(animate);

mapBtn.onclick = () => {
    render = drawMap;
    map.hidden = false;
    scene.hidden = true;
};

sceneBtn.onclick = () => {
    render = () => view.render();
    map.hidden = true;
    scene.hidden = false;
};
mapBtn.onclick();
