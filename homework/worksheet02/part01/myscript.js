"use strict";
window.onload = function () { main(); }

function add_point(array, point, size) {
    const offset = size / 2;
    var point_coords = [vec2(point[0] - offset, point[1] - offset), vec2(point[0] + offset, point[1] - offset),
    vec2(point[0] - offset, point[1] + offset), vec2(point[0] - offset, point[1] + offset),
    vec2(point[0] + offset, point[1] - offset), vec2(point[0] + offset, point[1] + offset)];
    array.push.apply(array, point_coords);
}

async function main() {
    const gpu = navigator.gpu;
    const adapter = await gpu.requestAdapter();
    const device = await adapter.requestDevice();
    const canvas = document.getElementById('my-canvas');
    const context = canvas.getContext('webgpu');
    const canvasFormat = navigator.gpu.getPreferredCanvasFormat();
    context.configure({
        device: device,
        format: canvasFormat,
    });

    const num_buffer_points = 1000;
    var positions = [];

    const positionBuffer = device.createBuffer({
        size: num_buffer_points * sizeof['vec2'],
        usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
    });
    device.queue.writeBuffer(positionBuffer, /*bufferOffset=*/0, flatten(positions));
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
    canvas.addEventListener("click", function (event) {
        const rect = canvas.getBoundingClientRect();
        const x = (event.clientX - rect.left) / canvas.width * 2 - 1;
        const y = (canvas.height - (event.clientY - rect.top)) / canvas.height * 2 - 1;
        const point_size = 10 * (2 / canvas.height);

        add_point(positions, vec2(x, y), point_size);
        for (let i = 0; i < 6; i++) {
            colors.push(vec3(1, 0, 0));
        }
        device.queue.writeBuffer(positionBuffer, /*bufferOffset=*/0, flatten(positions));
        device.queue.writeBuffer(colorBuffer, /*bufferOffset=*/0, flatten(colors));
        render();
    });
}