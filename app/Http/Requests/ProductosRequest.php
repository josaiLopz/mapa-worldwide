<?php

namespace App\Http\Requests;

use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Foundation\Http\FormRequest;

class ProductosRequest extends FormRequest
{
    /**
     * Determine if the user is authorized to make this request.
     */
    public function authorize(): bool
    {
        return true;
    }

    /**
     * Get the validation rules that apply to the request.
     *
     * @return array<string, ValidationRule|array<mixed>|string>
     */
    public function rules(): array
    {
        return [
            'local_id' => 'required|exists:locals,id',
            'nombre' => 'required|string|max:200',
            'descripcion' => 'nullable|string',
            'precio' => 'nullable|numeric|min:0',
            'imagen' => 'nullable|string|max:255',
            'activo' => 'nullable|boolean',
        ];
    }
}
