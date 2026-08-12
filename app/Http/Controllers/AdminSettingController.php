<?php

namespace App\Http\Controllers;

use App\Models\AdminSetting;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;

class AdminSettingController extends Controller
{
    public function show()
    {
        return response()->json($this->settings());
    }

    public function update(Request $request)
    {
        $this->ensureSuperadmin();

        $data = $request->validate([
            'background_color' => 'required|string|max:20',
        ]);

        $settings = $this->settings();
        $settings->update($data);

        return response()->json($settings);
    }

    public function uploadLogo(Request $request)
    {
        $this->ensureSuperadmin();

        $request->validate([
            'logo' => 'required|file|mimes:jpg,jpeg,png,svg,webp|max:2048',
        ]);

        $settings = $this->settings();

        if ($settings->logo && str_starts_with($settings->logo, '/storage/admin/')) {
            Storage::disk('public')->delete(str_replace('/storage/', '', $settings->logo));
        }

        $path = $request->file('logo')->store('admin', 'public');
        $settings->update(['logo' => Storage::url($path)]);

        return response()->json($settings);
    }

    private function settings(): AdminSetting
    {
        return AdminSetting::firstOrCreate([], [
            'background_color' => '#f3f4f6',
        ]);
    }
}
