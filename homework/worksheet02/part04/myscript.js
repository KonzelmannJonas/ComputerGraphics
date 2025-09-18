"use strict";
window.onload = function () { main(); }

function add_point(array, point, size) {
    const offset = size / 2;
    var point_coords = [vec2(point[0] - offset, point[1] - offset), vec2(point[0] + offset, point[1] - offset),
    vec2(point[0] - offset, point[1] + offset), vec2(point[0] - offset, point[1] + offset),
    vec2(point[0] + offset, point[1] - offset), vec2(point[0] + offset, point[1] + offset)];
    array.push.apply(array, point_coords);
}

let color_map = {
    "red": vec3(1, 0, 0),
    "green": vec3(0, 1, 0),
    "blue": vec3(0, 0, 1),
    "magenta": vec3(1, 0, 1),
    "cyan": vec3(0, 1, 1),
    "yellow": vec3(1, 1, 0),
    "black": vec3(0, 0, 0),
    "white": vec3(1, 1, 1),
}

async function main() {
    const gpu = navigator.gpu;
    const adapter = await gpu.requestAdapter();
    const device = await adapter.requestDevice();
    const canvas = document.getElementById('my-canvas');
    const clear_button = document.getElementById('clear-button');
    const color_selector = document.getElementById('color-selector');
    const context = canvas.getContext('webgpu');
    const canvasFormat = navigator.gpu.getPreferredCanvasFormat();
    context.configure({
        device: device,
        format: canvasFormat,
    });

    // 0: points, 1: triangles, 2: circles
    let draw_mode = 0;
    const point_button = document.getElementById('point-button');
    const triangle_button = document.getElementById('triangle-button');
    const circle_button = document.getElementById('circle-button');
    point_button.addEventListener("click", () => { draw_mode = 0; document.getElementById("draw-mode-status").innerText = "Current draw mode: Points"; });
    triangle_button.addEventListener("click", () => { draw_mode = 1; document.getElementById("draw-mode-status").innerText = "Current draw mode: Triangles"; });
    circle_button.addEventListener("click", () => { draw_mode = 2; document.getElementById("draw-mode-status").innerText = "Current draw mode: Circles"; });

    const num_buffer_points = 1000;
    var positions = [];

    const positionBuffer = device.createBuffer({
        size: num_buffer_points * sizeof['vec2'],
        usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
    });
    device.queue.writeBuffer(positionBuffer, 0, flatten(positions));
    const positionBufferLayout = {
        arrayStride: sizeof['vec2'],
        attributes: [{
            format: 'float32x2',
            offset: 0,
            shaderLocation: 0, // Position, see vertex shader
        }],
    };
    var colors = [];
    const colorBuffer = device.createBuffer({
        size: num_buffer_points * sizeof['vec3'], // 100 points
        usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
    });
    device.queue.writeBuffer(colorBuffer, /*bufferOffset=*/0, flatten(colors));
    const colorBufferLayout = {
        arrayStride: sizeof['vec3'],
        attributes: [{
            format: 'float32x3',
            offset: 0,
            shaderLocation: 1, // Color, see vertex shader
        }],
    };

    const wgslfile = document.getElementById('wgsl').src;
    const wgslcode
        = await fetch(wgslfile, { cache: "reload" }).then(r => r.text());
    const wgsl = device.createShaderModule({
        code: wgslcode
    });
    const pipeline = device.createRenderPipeline({
        layout: 'auto',
        vertex: {
            module: wgsl,
            entryPoint: 'main_vs',
            buffers: [positionBufferLayout, colorBufferLayout],
        },
        fragment: {
            module: wgsl,
            entryPoint: 'main_fs',
            targets: [{ format: canvasFormat }],
        },
        primitive: { topology: 'triangle-list', },
    });

    function render() {
        // Create a render pass in a command buffer and submit it
        const encoder = device.createCommandEncoder();
        const pass = encoder.beginRenderPass({
            colorAttachments: [{
                view: context.getCurrentTexture().createView(),
                loadOp: 'clear',
                storeOp: 'store',
                clearValue: { r: 0.3921, g: 0.5843, b: 0.9294, a: 1.0 },
            }],
        });
        // Insert render pass commands here
        pass.setPipeline(pipeline);
        pass.setVertexBuffer(0, positionBuffer);
        pass.setVertexBuffer(1, colorBuffer);
        pass.draw(positions.length)

        pass.end();
        device.queue.submit([encoder.finish()])
    }

    render();

    var last_two_pos = [];
    var last_two_colors = [];
    let triangle_count = 0;
    let circle_count = 0;
    let circle_center = vec2(0, 0);
    let circle_center_color = vec3(0, 0, 0);
    canvas.addEventListener("click", function (event) {
        if (draw_mode == 0) {
            const rect = canvas.getBoundingClientRect();
            const x = (event.clientX - rect.left) / canvas.width * 2 - 1;
            const y = (canvas.height - (event.clientY - rect.top)) / canvas.height * 2 - 1;
            const point_size = 10 * (2 / canvas.height);

            add_point(positions, vec2(x, y), point_size);
            for (let i = 0; i < 6; i++) {
                colors.push(color_map[color_selector.value]);
            }
            device.queue.writeBuffer(positionBuffer, /*bufferOffset=*/0, flatten(positions));
            device.queue.writeBuffer(colorBuffer, /*bufferOffset=*/0, flatten(colors));
            render();
        }
        else if (draw_mode == 1) {
            if (triangle_count < 2) {
                triangle_count += 1;
                // add point
                let rect = canvas.getBoundingClientRect();
                let x = (event.clientX - rect.left) / canvas.width * 2 - 1;
                let y = (canvas.height - (event.clientY - rect.top)) / canvas.height * 2 - 1;
                const point_size = 10 * (2 / canvas.height);

                last_two_pos.push(vec2(x, y));
                last_two_colors.push(color_map[color_selector.value]);

                add_point(positions, vec2(x, y), point_size);
                for (let i = 0; i < 6; i++) {
                    colors.push(color_map[color_selector.value]);
                }
                device.queue.writeBuffer(positionBuffer, 0, flatten(positions));
                device.queue.writeBuffer(colorBuffer, 0, flatten(colors));
                render();
            }
            else if (triangle_count == 2) {
                // add triangle and delete point from before
                let rect = canvas.getBoundingClientRect();
                let x = (event.clientX - rect.left) / canvas.width * 2 - 1;
                let y = (canvas.height - (event.clientY - rect.top)) / canvas.height * 2 - 1;
                positions.splice(-12);
                colors.splice(-12);

                positions.push(last_two_pos[0]);
                positions.push(last_two_pos[1]);
                positions.push(vec2(x, y));
                colors.push(last_two_colors[0]);
                colors.push(last_two_colors[1]);
                colors.push(color_map[color_selector.value]);

                triangle_count = 0;
                last_two_pos.length = 0;
                last_two_colors.length = 0;

                device.queue.writeBuffer(positionBuffer, 0, flatten(positions));
                device.queue.writeBuffer(colorBuffer, 0, flatten(colors));
                render();
            }
        }
        else if (draw_mode == 2) {
            if (circle_count == 0) {
                // add point
                circle_count = 1;
                let rect = canvas.getBoundingClientRect();
                let x = (event.clientX - rect.left) / canvas.width * 2 - 1;
                let y = (canvas.height - (event.clientY - rect.top)) / canvas.height * 2 - 1;
                const point_size = 10 * (2 / canvas.height);

                circle_center = vec2(x, y);
                circle_center_color = color_map[color_selector.value];

                add_point(positions, vec2(x, y), point_size);
                for (let i = 0; i < 6; i++) {
                    colors.push(color_map[color_selector.value]);
                }
                device.queue.writeBuffer(positionBuffer, 0, flatten(positions));
                device.queue.writeBuffer(colorBuffer, 0, flatten(colors));
                render();
            }
            else if (circle_count == 1) {
                let rect = canvas.getBoundingClientRect();
                let x = (event.clientX - rect.left) / canvas.width * 2 - 1;
                let y = (canvas.height - (event.clientY - rect.top)) / canvas.height * 2 - 1;

                let radius = Math.sqrt((x - circle_center[0]) ** 2 + (y - circle_center[1]) ** 2);
                positions.splice(-6);
                colors.splice(-6);
                const num_segments = 30;
                for (let i = 0; i < num_segments; i++) {
                    let angle = (i / num_segments) * Math.PI * 2;
                    let px = circle_center[0] + Math.cos(angle) * radius;
                    let py = circle_center[1] + Math.sin(angle) * radius;
                    positions.push(vec2(px, py));
                    colors.push(color_map[color_selector.value]);
                    let next_angle = ((i + 1) / num_segments) * Math.PI * 2;
                    let nx = circle_center[0] + Math.cos(next_angle) * radius;
                    let ny = circle_center[1] + Math.sin(next_angle) * radius;
                    positions.push(vec2(nx, ny));
                    colors.push(color_map[color_selector.value]);

                    positions.push(circle_center);
                    colors.push(circle_center_color);
                }
                circle_count = 0;
                circle_center = vec2(0, 0);
                circle_center_color = vec3(0, 0, 0);

                device.queue.writeBuffer(positionBuffer, 0, flatten(positions));
                device.queue.writeBuffer(colorBuffer, 0, flatten(colors));
                render();
            }
        }
    });

    clear_button.addEventListener("click", () => {
        positions = [];
        colors = [];
        device.queue.writeBuffer(positionBuffer, 0, flatten(positions));
        device.queue.writeBuffer(colorBuffer, 0, flatten(colors));
        render();
    });

}