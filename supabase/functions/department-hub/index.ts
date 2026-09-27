import {createDepartmentHandler,departmentConfig} from '../_shared/departments.mjs';
Deno.serve(createDepartmentHandler({config:departmentConfig((name:string)=>Deno.env.get(name))}));
