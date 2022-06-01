import { mat4, vec3 } from 'gl-matrix'

// return mvp matrix from given aspect, position, rotation, scale
function getMvpMatrix(
    aspect: number,
    position: {x:number, y:number, z:number},
    rotation: {x:number, y:number, z:number},
    scale: {x:number, y:number, z:number}
){
    // get modelView Matrix
    const modelViewMatrix = getModelViewMatrix(position, rotation, scale)
    // get projection Matrix
    const projectionMatrix = getProjectionMatrix(aspect)
    // get mvp matrix
    const mvpMatrix = mat4.create()
    mat4.multiply(mvpMatrix, projectionMatrix, modelViewMatrix)
    
    // return matrix as Float32Array
    return mvpMatrix as Float32Array
}

// return modelView matrix from given position, rotation, scale
function getModelViewMatrix(
    position = {x:0, y:0, z:0},
    rotation = {x:0, y:0, z:0},
    scale = {x:1, y:1, z:1}
){
    // get modelView Matrix
    const modelViewMatrix = mat4.create()
    // translate position
    mat4.translate(modelViewMatrix, modelViewMatrix, vec3.fromValues(position.x, position.y, position.z))
    // rotate
    mat4.rotateX(modelViewMatrix, modelViewMatrix, rotation.x)
    mat4.rotateY(modelViewMatrix, modelViewMatrix, rotation.y)
    mat4.rotateZ(modelViewMatrix, modelViewMatrix, rotation.z)
    // scale
    mat4.scale(modelViewMatrix, modelViewMatrix, vec3.fromValues(scale.x, scale.y, scale.z))
   
    // return matrix as Float32Array
    return modelViewMatrix as Float32Array
}

const center = vec3.fromValues(0,0,0)
const up = vec3.fromValues(0,1,0)

function getProjectionMatrix(
    aspect: number,
    fov:number = 60 / 180 * Math.PI,
    near:number = 0.1,
    far:number = 100.0,
    position = {x:0, y:0, z:0}
){  
    // create cameraview
    const cameraView = mat4.create()
    const eye = vec3.fromValues(position.x, position.y, position.z)
    mat4.translate(cameraView, cameraView, eye)
    mat4.lookAt(cameraView, eye, center, up)
    // get a perspective Matrix
    const projectionMatrix = mat4.create()
    mat4.perspective(projectionMatrix, fov, aspect, near, far)
    mat4.multiply(projectionMatrix, projectionMatrix, cameraView)
    // return matrix as Float32Array
    return projectionMatrix as Float32Array
}

export { getMvpMatrix, getModelViewMatrix, getProjectionMatrix }