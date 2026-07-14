import { IsNotEmpty, IsString } from 'class-validator';

// Request
export class LoginReqDTO {
    @IsNotEmpty()
    @IsString()
    userName :string;
    @IsNotEmpty()
    @IsString()
    password :string;
}

// Response
export class RoleRespDTO{
    id:number;
    name:string;
    displayName:string;

}

export class UserRespDTO{
    id: number;
    email: string;
    userName: string;
    mustChangePassord: boolean;
    role: RoleRespDTO;
}

export class LoginRespDTO{
    accessToken:string;
    refreshToken:string;
    user: UserRespDTO;
}