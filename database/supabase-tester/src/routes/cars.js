const express = require('express');
const router = express.Router();
const supabase = require('../config/db');

// Get all cars
router.get('/', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('cars')
      .select('*, owner:users(name)')
      .order('id');

    if (error) throw error;
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get cars by user ID
router.get('/user/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    const { data, error } = await supabase
      .from('cars')
      .select('*,users(*)')
      .eq('user_id', userId)
      .order('id');

    if (error) throw error;
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get car by ID
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { data, error } = await supabase
      .from('cars')
      .select('*,users(name)')
      .eq('id', id)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return res.status(404).json({ error: 'Car not found' });
      }
      throw error;
    }
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Create car
router.post('/', async (req, res) => {
  try {
    const { user_id, make, model, year } = req.body;
    if (!user_id || !make || !model || !year) {
      return res.status(400).json({ error: 'user_id, make, model, and year are required' });
    }

    const { data, error } = await supabase
      .from('cars')
      .insert([{ user_id, make, model, year }])
      .select()
      .single();

    if (error) {
      if (error.code === '23503') {
        return res.status(404).json({ error: 'User not found' });
      }
      throw error;
    }
    res.status(201).json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Update car
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { user_id, make, model, year } = req.body;
    if (!user_id || !make || !model || !year) {
      return res.status(400).json({ error: 'user_id, make, model, and year are required' });
    }

    const { data, error } = await supabase
      .from('cars')
      .update({ user_id, make, model, year })
      .eq('id', id)
      .select()
      .single();

    if (error) {
      if (error.code === '23503') {
        return res.status(404).json({ error: 'User not found' });
      }
      if (error.code === 'PGRST116') {
        return res.status(404).json({ error: 'Car not found' });
      }
      throw error;
    }
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Delete car
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { error } = await supabase
      .from('cars')
      .delete()
      .eq('id', id);

    if (error) throw error;
    res.json({ message: 'Car deleted successfully' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
