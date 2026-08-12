<?php

namespace App\Http\Requests;

use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Foundation\Http\FormRequest;

class Mapa_objetosRequest extends FormRequest
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
            'mapa_id' => 'required|exists:mapas,id',
            'local_id' => 'nullable|exists:locals,id',
            'tipo' => 'required|string',
            'x' => 'required|numeric',
            'y' => 'required|numeric',
            'width' => 'required|numeric|min:1',
            'height' => 'required|numeric|min:1',
            'nombre' => 'nullable|string|max:255',
            'rotation' => 'nullable|numeric',
            'color' => 'nullable|string',
            'metadata' => 'nullable|array',
        ];
    }
}
