router.post('/players/:id/assign', adminController.assignPlayerToTeam);
router.get('/players/:id/team', adminController.getPlayerTeam); 